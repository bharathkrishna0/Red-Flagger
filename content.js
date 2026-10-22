/* Red Flagger content script: collects a few page signals, asks the service worker for a verdict, shows a banner. */
(function () {
  'use strict';

  const MAX_TEXT = 20000;
  const BANNER_ID = 'red-flagger-banner-host';

  function collectFeatures() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const formActions = [];
    passwordInputs.forEach((input) => {
      const form = input.form;
      if (form) formActions.push(new URL(form.getAttribute('action') || location.href, location.href).href);
    });
    const secretInputs = document.querySelectorAll('textarea, input[type="text"]');
    return {
      hasPasswordField: passwordInputs.length > 0,
      hasSecretInputs: secretInputs.length >= 12 || document.querySelector('textarea') !== null,
      formActions,
      title: document.title || '',
      text: (document.body ? document.body.innerText : '').slice(0, MAX_TEXT),
    };
  }

  function removeBanner() {
    const old = document.getElementById(BANNER_ID);
    if (old) old.remove();
  }

  function showBanner(verdict) {
    removeBanner();
    const host = document.createElement('div');
    host.id = BANNER_ID;
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });

    const danger = verdict.level === 'danger';
    const style = document.createElement('style');
    style.textContent = `
      .bar { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff;
             background: ${danger ? '#c5221f' : '#e37400'}; padding: 10px 16px; box-shadow: 0 2px 8px rgba(0,0,0,.35);
             display: flex; gap: 12px; align-items: flex-start; }
      .flag { width: 22px; height: 22px; flex-shrink: 0; margin-top: 1px; }
      .body { flex: 1; }
      .title { font-weight: 700; font-size: 15px; }
      ul { margin: 4px 0 0; padding-left: 18px; }
      li { margin: 1px 0; }
      .actions { display: flex; gap: 8px; flex-shrink: 0; }
      button { font: inherit; border-radius: 4px; border: 1px solid rgba(255,255,255,.8); cursor: pointer; padding: 4px 10px; }
      .leave { background: #fff; color: ${danger ? '#c5221f' : '#b06000'}; font-weight: 700; }
      .ghost { background: transparent; color: #fff; }
    `;

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.setAttribute('role', 'alert');

    const flag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    flag.setAttribute('class', 'flag');
    flag.setAttribute('viewBox', '0 0 24 24');
    flag.setAttribute('aria-hidden', 'true');
    const flagPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flagPath.setAttribute('d', 'M5 2h2v20H5zM8 3h11l-3 4.5 3 4.5H8z');
    flagPath.setAttribute('fill', '#fff');
    flag.appendChild(flagPath);

    const body = document.createElement('div');
    body.className = 'body';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = danger
      ? `Red Flagger: this site looks dangerous (risk ${verdict.score}/100)`
      : `Red Flagger: be careful on this site (risk ${verdict.score}/100)`;
    const list = document.createElement('ul');
    verdict.reasons.slice(0, 4).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r.text;
      list.appendChild(li);
    });
    body.append(title, list);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const leave = document.createElement('button');
    leave.className = 'leave';
    leave.textContent = 'Leave site';
    leave.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.replace('about:blank');
    });
    const trust = document.createElement('button');
    trust.className = 'ghost';
    trust.textContent = 'Trust this site';
    trust.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'setTrust', host: location.hostname, trust: true }, () => {
        removeBanner();
        run();
      });
    });
    const dismiss = document.createElement('button');
    dismiss.className = 'ghost';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', removeBanner);
    actions.append(leave, trust, dismiss);

    bar.append(flag, body, actions);
    shadow.append(style, bar);
    (document.body || document.documentElement).appendChild(host);
  }

  function run() {
    chrome.runtime.sendMessage({ type: 'analyze', url: location.href, features: collectFeatures() }, (verdict) => {
      if (chrome.runtime.lastError || !verdict || verdict.error) return;
      if (verdict.showBanner) showBanner(verdict);
      else removeBanner();
    });
  }

  run();
  // Many login pages render their form after load; check once more for late password fields.
  setTimeout(() => {
    if (!document.getElementById(BANNER_ID) && document.querySelector('input[type="password"]')) run();
  }, 3000);
})();

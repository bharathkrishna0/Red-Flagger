'use strict';

const LABELS = {
  safe: 'No red flags found',
  warn: 'Be careful',
  danger: 'Likely scam or phishing',
};

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function el(tag, attrs, text) {
  const node = document.createElement(tag);
  Object.assign(node, attrs || {});
  if (text !== undefined) node.textContent = text;
  return node;
}

async function activeTabId() {
  const override = new URLSearchParams(location.search).get('tabId');
  if (override) return Number(override);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

function render(verdict, tabId) {
  const main = document.getElementById('content');
  main.replaceChildren();

  if (!verdict) {
    main.append(el('p', { className: 'muted' }, 'Red Flagger only checks regular web pages (http and https). Reload the page if it was open before the extension was installed.'));
    return;
  }

  main.append(el('p', { className: 'host' }, verdict.host));

  const box = el('div', { className: `verdict ${verdict.trusted ? 'trusted' : verdict.level}` });
  box.append(el('div', { className: 'label' }, verdict.trusted ? 'You trust this site' : LABELS[verdict.level]));
  box.append(el('div', {}, `Risk score ${verdict.score}/100`));
  main.append(box);

  if (verdict.reasons.length) {
    const list = el('ul');
    verdict.reasons.forEach((r) => list.append(el('li', {}, r.text)));
    main.append(list);
  } else {
    main.append(el('p', { className: 'muted' }, 'None of the checks matched. That is not a guarantee the site is safe.'));
  }

  const button = el('button', {}, verdict.trusted ? 'Stop trusting this site' : 'Trust this site');
  button.addEventListener('click', async () => {
    await send({ type: 'setTrust', host: verdict.host, trust: !verdict.trusted });
    render(await send({ type: 'getVerdict', tabId }), tabId);
  });
  main.append(button);
}

async function renderBlocklist() {
  const status = await send({ type: 'getStatus' });
  const node = document.getElementById('blocklist');
  if (!status.settings.useBlocklist) node.textContent = 'Blocklist off';
  else if (status.blocklist.fetchedAt) node.textContent = `Blocklist: ${status.blocklist.count} URLs`;
  else node.textContent = 'Blocklist not downloaded yet';
}

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async () => {
  const tabId = await activeTabId();
  render(tabId === null ? null : await send({ type: 'getVerdict', tabId }), tabId);
  renderBlocklist();
})();

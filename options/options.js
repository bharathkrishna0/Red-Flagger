'use strict';

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function renderBlocklist(blocklist) {
  const node = document.getElementById('blocklistStatus');
  if (blocklist.fetchedAt) {
    node.textContent = `${blocklist.count} phishing URLs, updated ${new Date(blocklist.fetchedAt).toLocaleString()}.`;
  } else {
    node.textContent = 'Not downloaded yet.';
  }
  if (blocklist.error) node.textContent += ` Last update failed: ${blocklist.error}.`;
}

function renderTrusted(trusted) {
  const list = document.getElementById('trusted');
  list.replaceChildren();
  if (!trusted.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No trusted sites yet. Use "Trust this site" in the popup or banner.';
    list.append(li);
    return;
  }
  trusted.slice().sort().forEach((domain) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = domain;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      await send({ type: 'setTrust', host: domain, trust: false });
      load();
    });
    li.append(name, remove);
    list.append(li);
  });
}

async function load() {
  const { settings, blocklist } = await send({ type: 'getStatus' });
  document.querySelector(`input[name="bannerLevel"][value="${settings.bannerLevel}"]`).checked = true;
  document.getElementById('useBlocklist').checked = settings.useBlocklist;
  renderBlocklist(blocklist);
  renderTrusted(settings.trusted);
}

document.querySelectorAll('input[name="bannerLevel"]').forEach((input) => {
  input.addEventListener('change', () => chrome.storage.sync.set({ bannerLevel: input.value }));
});

document.getElementById('useBlocklist').addEventListener('change', (e) => {
  chrome.storage.sync.set({ useBlocklist: e.target.checked });
});

document.getElementById('refresh').addEventListener('click', async (e) => {
  e.target.disabled = true;
  e.target.textContent = 'Updating…';
  const status = await send({ type: 'refreshBlocklist' });
  renderBlocklist(status.blocklist);
  e.target.disabled = false;
  e.target.textContent = 'Update now';
});

load();

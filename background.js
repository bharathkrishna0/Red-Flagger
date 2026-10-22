/* Red Flagger service worker: scoring, blocklist refresh, badge and per-tab verdicts. */
importScripts('src/heuristics.js', 'src/blocklist.js');

const H = self.RedFlaggerHeuristics;
const B = self.RedFlaggerBlocklist;

const REFRESH_ALARM = 'refresh-blocklist';
const REFRESH_MINUTES = 12 * 60;
const DEFAULT_SETTINGS = { useBlocklist: true, bannerLevel: 'warn', trusted: [] };

const BADGE = {
  safe: { text: 'OK', color: '#1e8e3e' },
  warn: { text: '!', color: '#f29900' },
  danger: { text: '!!', color: '#d93025' },
  trusted: { text: '✓', color: '#5f6368' },
};

let blocklistIndex = null;

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function loadIndex() {
  if (blocklistIndex) return blocklistIndex;
  const { blocklist } = await chrome.storage.local.get('blocklist');
  blocklistIndex = B.buildIndex(blocklist ? blocklist.urls : []);
  return blocklistIndex;
}

async function refreshBlocklist() {
  try {
    const res = await fetch(B.FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const urls = B.parseFeed(await res.text());
    await chrome.storage.local.set({ blocklist: { urls, fetchedAt: Date.now(), error: null } });
    blocklistIndex = B.buildIndex(urls);
  } catch (err) {
    const { blocklist } = await chrome.storage.local.get('blocklist');
    await chrome.storage.local.set({
      blocklist: { urls: [], fetchedAt: null, ...blocklist, error: String(err.message || err) },
    });
  }
}

function isTrusted(settings, host) {
  const domain = H.registrableDomain(host);
  return settings.trusted.some((t) => t === host || t === domain);
}

async function evaluate(url, features) {
  const settings = await getSettings();
  const host = H.hostOf(url);
  const verdict = H.analyze(url, features);

  if (settings.useBlocklist) {
    const hit = B.lookup(await loadIndex(), url);
    if (hit) {
      verdict.reasons.unshift({ points: 100, text: `Listed as phishing by the OpenPhish feed (${hit})` });
      verdict.score = 100;
      verdict.level = 'danger';
    }
  }

  const trusted = isTrusted(settings, host);
  const order = { safe: 0, warn: 1, danger: 2 };
  const showBanner = !trusted && verdict.level !== 'safe' && order[verdict.level] >= order[settings.bannerLevel];
  return { ...verdict, url, host, trusted, showBanner, checkedAt: Date.now() };
}

async function setBadge(tabId, verdict) {
  const style = verdict.trusted ? BADGE.trusted : BADGE[verdict.level];
  await chrome.action.setBadgeText({ tabId, text: style.text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: style.color });
  await chrome.action.setTitle({
    tabId,
    title: verdict.trusted ? 'Red Flagger: you trust this site' : `Red Flagger: risk score ${verdict.score}/100`,
  });
}

async function saveVerdict(tabId, verdict) {
  await chrome.storage.session.set({ [`tab:${tabId}`]: verdict });
}

async function updateTrust(host, trust) {
  const settings = await getSettings();
  const domain = H.registrableDomain(host);
  const trusted = settings.trusted.filter((t) => t !== host && t !== domain);
  if (trust) trusted.push(domain);
  await chrome.storage.sync.set({ trusted });
}

async function handle(message, sender) {
  switch (message.type) {
    case 'analyze': {
      const verdict = await evaluate(message.url, message.features);
      if (sender.tab) {
        await saveVerdict(sender.tab.id, { ...verdict, features: message.features });
        await setBadge(sender.tab.id, verdict);
      }
      return verdict;
    }
    case 'getVerdict': {
      const key = `tab:${message.tabId}`;
      const stored = (await chrome.storage.session.get(key))[key] || null;
      if (!stored) return null;
      const fresh = await evaluate(stored.url, stored.features);
      await saveVerdict(message.tabId, { ...fresh, features: stored.features });
      await setBadge(message.tabId, fresh);
      return fresh;
    }
    case 'setTrust': {
      await updateTrust(message.host, message.trust);
      return { ok: true };
    }
    case 'getStatus': {
      const { blocklist } = await chrome.storage.local.get('blocklist');
      return {
        settings: await getSettings(),
        blocklist: blocklist
          ? { count: blocklist.urls.length, fetchedAt: blocklist.fetchedAt, error: blocklist.error }
          : { count: 0, fetchedAt: null, error: null },
      };
    }
    case 'refreshBlocklist': {
      await refreshBlocklist();
      return handle({ type: 'getStatus' }, sender);
    }
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender).then(sendResponse, (err) => sendResponse({ error: String(err) }));
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES });
  await refreshBlocklist();
});

chrome.runtime.onStartup.addListener(async () => {
  const { blocklist } = await chrome.storage.local.get('blocklist');
  if (!blocklist || !blocklist.fetchedAt || Date.now() - blocklist.fetchedAt > REFRESH_MINUTES * 60000) {
    await refreshBlocklist();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshBlocklist();
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`));

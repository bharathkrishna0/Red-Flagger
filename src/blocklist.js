/*
 * Matching against the OpenPhish community feed (one phishing URL per line).
 * Pure functions; the service worker handles downloading and storage.
 */
(function (root) {
  'use strict';

  const FEED_URL = 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt';

  function normalize(url) {
    try {
      const u = new URL(url.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      const path = u.pathname.replace(/\/+$/, '');
      return { host: u.hostname.toLowerCase().replace(/^www\./, ''), path, search: u.search };
    } catch (_) {
      return null;
    }
  }

  function parseFeed(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l));
  }

  /*
   * Index: host -> list of path prefixes ('' = the whole host is listed).
   * Only exact hostnames are matched, so a listed site on a shared host
   * (e.g. evil.pages.dev) never flags the rest of pages.dev.
   */
  function buildIndex(urls) {
    const index = new Map();
    for (const raw of urls) {
      const n = normalize(raw);
      if (!n) continue;
      if (!index.has(n.host)) index.set(n.host, []);
      index.get(n.host).push(n.path + n.search);
    }
    return index;
  }

  function lookup(index, url) {
    const n = normalize(url);
    if (!n || !index) return null;
    const entries = index.get(n.host);
    if (!entries) return null;
    const full = n.path + n.search;
    for (const prefix of entries) {
      if (prefix === '' || full === prefix || full.startsWith(prefix.endsWith('/') ? prefix : prefix + '/') || full.startsWith(prefix + '?')) {
        return prefix === '' ? n.host : n.host + prefix;
      }
    }
    return null;
  }

  const api = { FEED_URL, normalize, parseFeed, buildIndex, lookup };
  root.RedFlaggerBlocklist = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

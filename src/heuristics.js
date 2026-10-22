/*
 * Red Flagger detection rules.
 *
 * Pure functions, no browser APIs: loaded as a classic script by the content
 * script and the service worker, and with require() by the Node tests.
 */
(function (root) {
  'use strict';

  const WARN_SCORE = 30;
  const DANGER_SCORE = 60;

  const MULTI_PART_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
    'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.kr', 'com.br', 'com.cn', 'com.mx',
    'com.sg', 'com.my', 'com.pk', 'com.tr', 'co.za', 'com.ng', 'com.ar', 'com.hk',
  ]);

  const RISKY_TLDS = new Set([
    'zip', 'mov', 'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'icu', 'click', 'cfd', 'sbs',
    'rest', 'cam', 'quest', 'bond', 'cyou', 'buzz', 'monster', 'lol', 'shop', 'live', 'support',
  ]);

  const SHARED_HOSTS = [
    'webflow.io', 'pages.dev', 'workers.dev', 'vercel.app', 'netlify.app', 'firebaseapp.com',
    'web.app', 'github.io', 'glitch.me', 'weebly.com', 'wixsite.com', 'blogspot.com',
    'framer.website', 'framer.app', 'ngrok.io', 'ngrok-free.app', 'repl.co', 'onrender.com',
    'herokuapp.com', 'sites.google.com', 'square.site', 'godaddysites.com', 'duckdns.org',
  ];

  const BRANDS = {
    paypal: ['paypal.com', 'paypal.me'],
    apple: ['apple.com', 'icloud.com'],
    icloud: ['icloud.com', 'apple.com'],
    microsoft: ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com', 'outlook.com'],
    outlook: ['outlook.com', 'live.com', 'microsoft.com', 'office.com'],
    office365: ['office.com', 'microsoft.com'],
    google: ['google.com', 'google.co.in', 'youtube.com', 'gmail.com'],
    gmail: ['gmail.com', 'google.com'],
    amazon: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'aws.amazon.com'],
    netflix: ['netflix.com'],
    facebook: ['facebook.com', 'fb.com', 'meta.com'],
    instagram: ['instagram.com'],
    whatsapp: ['whatsapp.com', 'whatsapp.net'],
    linkedin: ['linkedin.com'],
    binance: ['binance.com'],
    coinbase: ['coinbase.com'],
    metamask: ['metamask.io'],
    dropbox: ['dropbox.com'],
    docusign: ['docusign.com', 'docusign.net'],
    adobe: ['adobe.com'],
    steam: ['steampowered.com', 'steamcommunity.com'],
    paytm: ['paytm.com', 'paytm.in'],
    phonepe: ['phonepe.com'],
    flipkart: ['flipkart.com'],
    hdfc: ['hdfcbank.com', 'hdfc.com'],
    icici: ['icicibank.com', 'icici.com'],
    onlinesbi: ['onlinesbi.sbi', 'sbi.co.in'],
    chase: ['chase.com'],
    wellsfargo: ['wellsfargo.com'],
    dhl: ['dhl.com'],
    fedex: ['fedex.com'],
    usps: ['usps.com'],
  };

  const URGENCY_PHRASES = [
    'verify your account', 'account has been suspended', 'account will be suspended',
    'account has been locked', 'unusual activity', 'unusual sign-in', 'confirm your identity',
    'update your payment', 'your account will be closed', 'act now', 'within 24 hours',
    'you have won', 'claim your prize', 'claim your reward', 'gift card',
    'kyc update', 'kyc expired', 'your parcel', 'delivery failed', 'customs fee',
  ];

  const WALLET_PHRASES = ['seed phrase', 'recovery phrase', 'secret recovery', 'private key', 'mnemonic phrase'];

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    } catch (_) {
      return '';
    }
  }

  function isIpHost(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':');
  }

  function registrableDomain(host) {
    if (!host || isIpHost(host)) return host;
    const labels = host.split('.');
    if (labels.length <= 2) return host;
    const lastTwo = labels.slice(-2).join('.');
    if (MULTI_PART_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
    return lastTwo;
  }

  function hostMatches(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  function deLeet(s) {
    return s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/rn/g, 'm');
  }

  function isOfficialFor(brand, host) {
    return BRANDS[brand].some((d) => hostMatches(host, d));
  }

  /* Brands named in the hostname (as a whole token, or a near-miss spelling) on a domain the brand doesn't own. */
  function impersonatedBrands(host) {
    const found = [];
    const tokens = host.split(/[.-]/).filter(Boolean);
    for (const brand of Object.keys(BRANDS)) {
      if (isOfficialFor(brand, host)) continue;
      const exact = tokens.includes(brand);
      const lookalike = !exact && brand.length >= 5 && tokens.some((t) => {
        if (t === brand) return false;
        const d = editDistance(t, brand);
        return d === 1 || deLeet(t) === brand;
      });
      if (exact || lookalike) found.push({ brand, lookalike });
    }
    return found;
  }

  function sharedHostOf(host) {
    return SHARED_HOSTS.find((d) => hostMatches(host, d) && host !== d) || null;
  }

  const DISPLAY_NAMES = {
    paypal: 'PayPal', icloud: 'iCloud', office365: 'Office 365', whatsapp: 'WhatsApp',
    linkedin: 'LinkedIn', metamask: 'MetaMask', docusign: 'DocuSign', phonepe: 'PhonePe',
    hdfc: 'HDFC', icici: 'ICICI', onlinesbi: 'SBI', wellsfargo: 'Wells Fargo', dhl: 'DHL', fedex: 'FedEx',
  };

  function capitalize(s) {
    return DISPLAY_NAMES[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }

  /*
   * features (all optional, collected by the content script):
   *   hasPasswordField, title, text (visible text, truncated),
   *   formActions (absolute URLs forms submit to), hasSecretInputs
   */
  function analyze(url, features) {
    const f = features || {};
    const reasons = [];
    const add = (points, text) => reasons.push({ points, text });

    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return { score: 0, level: 'safe', reasons: [] };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { score: 0, level: 'safe', reasons: [] };
    }

    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const domain = registrableDomain(host);
    const tld = host.split('.').pop();
    const isHttp = parsed.protocol === 'http:';
    const isLocal = host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]';

    if (isIpHost(host) && !isLocal) add(30, 'The address is a raw IP number instead of a domain name');
    if (parsed.username || parsed.password) add(30, 'The link hides the real destination behind an "@" in the address');
    if (host.split('.').some((l) => l.startsWith('xn--'))) add(30, 'The domain uses punycode, which can disguise lookalike characters');
    if (RISKY_TLDS.has(tld)) add(15, `The ".${tld}" ending is common on throwaway scam domains`);
    if (host.split('.').length > 4) add(10, 'The address has an unusually deep chain of subdomains');
    if ((host.match(/-/g) || []).length >= 3) add(10, 'The domain name is stitched together with many hyphens');
    if (host.length > 50) add(5, 'The domain name is unusually long');

    const impersonated = impersonatedBrands(host);
    for (const { brand, lookalike } of impersonated) {
      add(lookalike ? 40 : 35, lookalike
        ? `The domain looks like a misspelling of "${capitalize(brand)}" but isn't one of its sites`
        : `The domain mentions "${capitalize(brand)}" but isn't one of its sites`);
    }

    if (f.hasPasswordField) {
      if (isHttp && !isLocal) add(30, 'The page asks for a password over an unencrypted (http) connection');
      const shared = sharedHostOf(host);
      if (shared) add(20, `The login page is hosted on a free site builder (${shared})`);
      if (impersonated.length) add(25, `The page asks you to log in on a site posing as ${capitalize(impersonated[0].brand)}`);
      const offsite = (f.formActions || []).map(hostOf).find((h) => h && registrableDomain(h) !== domain);
      if (offsite) add(30, `The login form sends what you type to a different site (${offsite})`);
      const title = (f.title || '').toLowerCase();
      const claimed = Object.keys(BRANDS).find((b) => new RegExp(`\\b${b}\\b`).test(title) && !isOfficialFor(b, host));
      if (claimed && !reasons.some((r) => r.text.includes(`"${capitalize(claimed)}"`))) {
        add(25, `The page title claims to be ${capitalize(claimed)} but the domain isn't one of its sites`);
      }
    }

    const text = (f.text || '').toLowerCase();
    if (text) {
      const hits = URGENCY_PHRASES.filter((p) => text.includes(p));
      if (hits.length) add(Math.min(24, 8 * hits.length), `Pressure wording: "${hits.slice(0, 3).join('", "')}"`);
      const wallet = WALLET_PHRASES.find((p) => text.includes(p));
      if (wallet && (f.hasSecretInputs || f.hasPasswordField)) add(30, `The page asks you to type your crypto wallet ${wallet}`);
    }

    const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
    reasons.sort((a, b) => b.points - a.points);
    return { score, level: levelFor(score), reasons };
  }

  function levelFor(score) {
    if (score >= DANGER_SCORE) return 'danger';
    if (score >= WARN_SCORE) return 'warn';
    return 'safe';
  }

  const api = {
    analyze, levelFor, registrableDomain, impersonatedBrands, hostOf, editDistance,
    WARN_SCORE, DANGER_SCORE,
  };
  root.RedFlaggerHeuristics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

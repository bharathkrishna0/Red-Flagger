const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/heuristics.js');

const login = (extra) => ({ hasPasswordField: true, formActions: [], title: '', text: '', ...extra });

test('ordinary sites score as safe', () => {
  for (const url of [
    'https://www.wikipedia.org/',
    'https://github.com/bharathkrishna0/Red-Flagger',
    'https://www.applebees.com/en',
    'https://news.ycombinator.com/item?id=1',
    'http://localhost:3000/login',
  ]) {
    const v = H.analyze(url, login());
    assert.equal(v.level, 'safe', `${url}: ${JSON.stringify(v.reasons)}`);
  }
});

test('brand owners are not flagged on their own domains', () => {
  for (const url of ['https://www.paypal.com/signin', 'https://accounts.google.com/', 'https://login.microsoftonline.com/', 'https://www.amazon.co.uk/ap/signin', 'https://retail.onlinesbi.sbi/']) {
    assert.equal(H.analyze(url, login({ title: 'Sign in' })).level, 'safe', url);
  }
});

test('brand name on a foreign domain with a login form is dangerous', () => {
  const v = H.analyze('https://paypal-secure-login.xyz/verify', login({ title: 'PayPal: Log in' }));
  assert.equal(v.level, 'danger');
  assert.ok(v.reasons.some((r) => r.text.includes('"PayPal"')));
});

test('typosquats of brands are caught', () => {
  for (const url of ['https://paypa1.com/', 'https://www.arnazon.com/', 'https://netfllx.com/login']) {
    const v = H.analyze(url, {});
    assert.ok(v.reasons.some((r) => r.text.includes('misspelling')), `${url}: ${JSON.stringify(v.reasons)}`);
  }
});

test('raw IP, @ trick and punycode are flagged', () => {
  assert.ok(H.analyze('http://45.12.9.8/bank/login', {}).score >= 30);
  assert.ok(H.analyze('https://www.google.com@evil.example/', {}).reasons.some((r) => r.text.includes('@')));
  assert.ok(H.analyze('https://xn--pypal-4ve.com/', {}).reasons.some((r) => r.text.includes('punycode')));
});

test('password over http and off-site form posting add risk', () => {
  const v = H.analyze('http://shop.example.com/login', login({ formActions: ['https://collector.example.net/p.php'] }));
  assert.equal(v.level, 'danger');
  assert.ok(v.reasons.some((r) => r.text.includes('unencrypted')));
  assert.ok(v.reasons.some((r) => r.text.includes('collector.example.net')));
});

test('same-site form posting is fine', () => {
  const v = H.analyze('https://example.com/login', login({ formActions: ['https://auth.example.com/session'] }));
  assert.equal(v.level, 'safe');
});

test('login on a free site builder plus pressure wording warns', () => {
  const v = H.analyze('https://my-webmail-update.webflow.io/', login({ text: 'Unusual activity detected. Verify your account within 24 hours.' }));
  assert.notEqual(v.level, 'safe');
  assert.ok(v.reasons.some((r) => r.text.includes('webflow.io')));
});

test('wallet seed phrase requests are flagged', () => {
  const v = H.analyze('https://wallet-sync.example.org/', { hasSecretInputs: true, text: 'Enter your 12 word secret recovery phrase to restore' });
  assert.ok(v.reasons.some((r) => r.text.includes('wallet')));
});

test('non-web URLs are ignored', () => {
  assert.deepEqual(H.analyze('chrome://extensions/', {}), { score: 0, level: 'safe', reasons: [] });
  assert.deepEqual(H.analyze('not a url', {}), { score: 0, level: 'safe', reasons: [] });
});

test('registrableDomain handles common multi-part suffixes', () => {
  assert.equal(H.registrableDomain('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(H.registrableDomain('a.b.example.com'), 'example.com');
  assert.equal(H.registrableDomain('10.0.0.1'), '10.0.0.1');
});

test('score is capped at 100 and level thresholds hold', () => {
  const v = H.analyze('http://paypal-verify-account-secure.login.update.xyz/', login({ title: 'PayPal', formActions: ['http://1.2.3.4/x'], text: 'verify your account act now' }));
  assert.equal(v.score, 100);
  assert.equal(H.levelFor(29), 'safe');
  assert.equal(H.levelFor(30), 'warn');
  assert.equal(H.levelFor(60), 'danger');
});

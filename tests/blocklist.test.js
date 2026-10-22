const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/blocklist.js');

const feed = [
  'https://my-top-juno-webmail-site.webflow.io/',
  'http://evil.example.com/paypal/login',
  'https://www.bad.example.net/a?id=1',
  'not a url',
  '',
].join('\n');

const index = B.buildIndex(B.parseFeed(feed));

test('parseFeed keeps only http(s) lines', () => {
  assert.equal(B.parseFeed(feed).length, 3);
});

test('a listed host root flags the whole host only', () => {
  assert.ok(B.lookup(index, 'https://my-top-juno-webmail-site.webflow.io/inbox'));
  assert.equal(B.lookup(index, 'https://other-site.webflow.io/'), null);
  assert.equal(B.lookup(index, 'https://webflow.io/'), null);
});

test('a listed path flags that path and below, not siblings', () => {
  assert.ok(B.lookup(index, 'https://evil.example.com/paypal/login'));
  assert.ok(B.lookup(index, 'https://evil.example.com/paypal/login/step2'));
  assert.equal(B.lookup(index, 'https://evil.example.com/paypal/loginx'), null);
  assert.equal(B.lookup(index, 'https://evil.example.com/'), null);
});

test('www prefix and query strings are handled', () => {
  assert.ok(B.lookup(index, 'https://bad.example.net/a?id=1'));
  assert.equal(B.lookup(index, 'https://bad.example.net/a?id=2'), null);
});

test('lookup is safe with no index or bad input', () => {
  assert.equal(B.lookup(null, 'https://x.com'), null);
  assert.equal(B.lookup(index, 'garbage'), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternalLinkUrl } from '../src/externalLinks.js';

test('isExternalLinkUrl accepts http/https/mailto URLs', () => {
  assert.equal(isExternalLinkUrl('http://example.com'), true);
  assert.equal(isExternalLinkUrl('https://example.com'), true);
  assert.equal(isExternalLinkUrl('mailto:stian@taknes.no'), true);
});

test('isExternalLinkUrl rejects other schemes and non-strings', () => {
  assert.equal(isExternalLinkUrl('ftp://example.com'), false);
  assert.equal(isExternalLinkUrl('javascript:alert(1)'), false);
  assert.equal(isExternalLinkUrl('/local/path'), false);
  assert.equal(isExternalLinkUrl(''), false);
  assert.equal(isExternalLinkUrl(undefined), false);
  assert.equal(isExternalLinkUrl(null), false);
});

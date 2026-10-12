import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionEmbeds } from '../../lib/questionEmbeds.mjs';

test('extracts plain and markdown links once, without punctuation', () => {
  const links = questionEmbeds('Read [this](https://example.com/page). Also https://example.com/page.');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://example.com/page');
});
test('preserves balanced parentheses in URLs', () => {
  assert.equal(questionEmbeds('[Read](https://example.com/wiki/Foo_(bar))')[0].href, 'https://example.com/wiki/Foo_(bar)');
});
test('ignores code, executable schemes and credential URLs', () => {
  assert.deepEqual(questionEmbeds('`https://example.com` ```https://example.org``` javascript:alert(1) https://user:pass@example.com'), []);
});
test('normalizes supported video and file providers', () => {
  assert.equal(questionEmbeds('https://youtu.be/dQw4w9WgXcQ?t=30')[0].src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(questionEmbeds('https://www.youtube.com/watch?v=dQw4w9WgXcQ')[0].kind, 'video');
  assert.equal(questionEmbeds('https://vimeo.com/12345')[0].src, 'https://player.vimeo.com/video/12345');
  assert.equal(questionEmbeds('https://drive.google.com/file/d/abc123/view?usp=sharing')[0].src, 'https://drive.google.com/file/d/abc123/preview');
});
test('does not treat lookalike domains as providers', () => {
  assert.equal(questionEmbeds('https://youtube.com.example.org/watch?v=dQw4w9WgXcQ')[0].kind, 'page');
  assert.deepEqual(questionEmbeds(null), []);
});

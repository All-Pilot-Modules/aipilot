import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const dark = css.slice(css.indexOf('.dark {', css.indexOf('--radius:')));
const tokens = Object.fromEntries([...dark.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
function rgb(name) {
  const value = tokens[name];
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref) return rgb(ref[1]);
  assert.match(value, /^#[0-9a-f]{6}$/i, `Expected measurable color: ${name}`);
  return value.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
}
function luminance(name) {
  return rgb(name).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test('dark theme text meets normal-text contrast on all shared surfaces', () => {
  for (const surface of ['background', 'card', 'popover', 'muted', 'accent']) {
    for (const text of ['foreground', 'muted-foreground', 'destructive']) {
      assert.ok(contrast(text, surface) >= 4.5, `${text} on ${surface}: ${contrast(text, surface).toFixed(2)}`);
    }
  }
  for (const surface of ['primary', 'secondary', 'destructive', 'sidebar']) {
    assert.ok(contrast(`${surface}-foreground`, surface) >= 4.5, `${surface} foreground`);
  }
});
test('dark theme input boundaries and keyboard focus remain visible', () => {
  for (const surface of ['background', 'card', 'popover']) {
    for (const control of ['input', 'ring']) assert.ok(contrast(control, surface) >= 3, `${control} on ${surface}`);
  }
});

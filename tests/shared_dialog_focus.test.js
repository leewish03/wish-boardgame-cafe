import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const source = transformSync(readFileSync('src/shared/useDialogFocus.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
let effect, panel;
const listeners = new Map();
let nextFrame = 0;
globalThis.requestAnimationFrame = () => ++nextFrame;
globalThis.cancelAnimationFrame = () => {};
class Element {
  constructor(name) { this.name = name; this.isConnected = true; }
  focus() { document.activeElement = this; }
  closest() { return this.nativeModal ?? null; }
  contains(element) { return element === this || this.controls?.includes(element); }
  querySelectorAll() { return this.controls; }
  getClientRects() { return [{}]; }
}
globalThis.window = { HTMLElement: Element };
globalThis.document = {
  activeElement: new Element('trigger'),
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: name => listeners.delete(name),
};
const module = { exports: {} };
new Function('require', 'module', source)(() => ({ useEffect: fn => { effect = fn; }, useRef: value => ({ current: value === null ? panel : value }) }), module);
const trigger = document.activeElement;
panel = new Element('custom result');
panel.controls = [new Element('first'), new Element('last')];
let closeCount = 0;
module.exports.useDialogFocus(true, () => closeCount++);
const cleanup = effect();
const key = (value, shiftKey = false) => {
  const event = { key: value, shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
  listeners.get('keydown')(event);
  return event;
};

const native = new Element('screen settings');
const nativeButton = new Element('screen settings close');
nativeButton.nativeModal = native;
document.activeElement = nativeButton;
assert.equal(key('Escape').prevented, false, 'native dialog owns Escape; lower result must not consume it');
assert.equal(closeCount, 0, 'screen settings Escape must not close lower result');
assert.equal(key('Tab').prevented, false, 'native dialog owns its Tab loop');
assert.equal(document.activeElement, nativeButton, 'lower panel must not steal native focus');

document.activeElement = panel.controls[1];
assert.equal(key('Tab').prevented, true);
assert.equal(document.activeElement, panel.controls[0]);
assert.equal(key('Tab', true).prevented, true);
assert.equal(document.activeElement, panel.controls[1]);
assert.equal(key('Escape').prevented, true);
assert.equal(closeCount, 1);
cleanup();
assert.equal(document.activeElement, trigger, 'closing result restores trigger');
assert.equal(listeners.size, 0, 'cleanup removes key listener');
console.log('PASS shared focus: native stacking, custom Tab loop, Escape, restoration, cleanup');

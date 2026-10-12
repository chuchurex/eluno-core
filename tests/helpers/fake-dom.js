// Minimal DOM stand-in for running the browser scripts in js/ under node:test.
// Only implements what those scripts touch; extend it when a script needs more.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

export class FakeElement {
  constructor({ className = '', attrs = {}, id = '' } = {}) {
    this.className = className;
    this.id = id;
    this.attrs = { ...attrs };
    this.style = {};
    this.innerHTML = '';
    this.listeners = {};
    this.classList = {
      toggle: (name, on) => {
        const set = new Set(this.className.split(' ').filter(Boolean));
        on ? set.add(name) : set.delete(name);
        this.className = [...set].join(' ');
      },
      contains: (name) => this.className.split(' ').includes(name)
    };
  }
  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn({ preventDefault() {}, ...event }));
  }
  querySelectorAll() {
    return [];
  }
}

// selectors: { '.css-selector': FakeElement | FakeElement[] }
export function createDocument(selectors = {}) {
  const documentElement = new FakeElement();
  const listeners = {};
  const all = (sel) => {
    const v = selectors[sel];
    return v ? (Array.isArray(v) ? v : [v]) : [];
  };
  return {
    documentElement,
    querySelector: (sel) => all(sel)[0] || null,
    querySelectorAll: all,
    getElementById: (id) => Object.values(selectors).flat().find((el) => el.id === id) || null,
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    fire: (type) => (listeners[type] || []).forEach((fn) => fn())
  };
}

export function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k]
  };
}

// Runs a script from js/ in a sandbox; returns the sandbox so tests can call its globals.
export function runScript(relPath, { document, localStorage = createStorage(), hash = '' }) {
  const code = readFileSync(new URL(`../../${relPath}`, import.meta.url), 'utf8');
  const window = { location: { hash }, addEventListener() {} };
  const sandbox = { document, localStorage, window, setTimeout: () => 0, console };
  // `const` declarations stay script-scoped; expose the ones tests need.
  runInNewContext(`${code}\n;this.__exports = { toggleTheme: typeof toggleTheme !== 'undefined' ? toggleTheme : undefined };`, sandbox);
  return sandbox;
}

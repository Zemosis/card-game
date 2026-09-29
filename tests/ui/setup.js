// jsdom has no layout, audio or observers: stub what the table components use.
// Reduced motion is on so GSAP work collapses to (near) instant.

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  constructor(cb) {
    this.cb = cb;
  }
  observe(el) {
    this.cb([{ target: el, contentRect: { width: 900, height: 200 } }]);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverStub;

Element.prototype.scrollTo = function scrollTo() {};

vi.mock("../../src/utils/SoundManager", () => {
  const soundManager = new Proxy({ context: null }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { soundManager, default: soundManager };
});

// Avatars paint on a canvas; jsdom returns null for getContext.
const noopContext = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });
HTMLCanvasElement.prototype.getContext = () => noopContext;

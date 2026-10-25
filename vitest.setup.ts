import "@testing-library/jest-dom/vitest";

// jsdom does not implement window.matchMedia. Components that read responsive
// state at runtime (e.g. the cosmic Starfield backdrop) call it on mount, so
// provide a minimal, always-false stub for the test environment.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

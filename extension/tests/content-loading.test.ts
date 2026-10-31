import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyAvailable,
  documentLoaded,
  loadStylesheet,
} from "../src/content/DomEvents";

function setGlobal(name: string, value: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  };
}

test("waits for body even when head already exists", async () => {
  const fakeDocument = { head: {}, body: null as object | null };
  let notifyMutation: (() => void) | undefined;
  const restoreDocument = setGlobal("document", fakeDocument);
  const restoreObserver = setGlobal(
    "MutationObserver",
    class {
      constructor(
        callback: (
          _mutations: unknown[],
          observer: { disconnect: () => void },
        ) => void,
      ) {
        notifyMutation = () => callback([], this);
      }
      observe() {}
      disconnect() {}
    },
  );

  try {
    let resolved = false;
    const ready = bodyAvailable().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);

    fakeDocument.body = {};
    notifyMutation?.();
    await ready;
    assert.equal(resolved, true);
  } finally {
    restoreObserver();
    restoreDocument();
  }
});

test("page load alone does not make the viewer stylesheet ready", async () => {
  const link = Object.assign(new EventTarget(), { remove() {} });
  const fakeDocument = {
    readyState: "loading",
    head: { appendChild() {} },
    createElement: () => link,
  };
  const fakeWindow = new EventTarget();
  const restoreDocument = setGlobal("document", fakeDocument);
  const restoreWindow = setGlobal("window", fakeWindow);

  try {
    let ready = false;
    const prerequisites = Promise.all([
      documentLoaded(),
      loadStylesheet("chrome-extension://test/assets/content.css"),
    ]).then(() => {
      ready = true;
    });

    fakeWindow.dispatchEvent(new Event("load"));
    await Promise.resolve();
    assert.equal(ready, false);

    link.dispatchEvent(new Event("load"));
    await prerequisites;
    assert.equal(ready, true);
  } finally {
    restoreWindow();
    restoreDocument();
  }
});

test("stylesheet failure rejects instead of rendering an unstyled viewer", async () => {
  let removed = false;
  const link = Object.assign(new EventTarget(), {
    remove() {
      removed = true;
    },
  });
  const restoreDocument = setGlobal("document", {
    head: { appendChild() {} },
    createElement: () => link,
  });

  try {
    const ready = loadStylesheet("chrome-extension://test/assets/content.css");
    link.dispatchEvent(new Event("error"));
    await assert.rejects(ready, /Unable to load viewer stylesheet/);
    assert.equal(removed, true);
  } finally {
    restoreDocument();
  }
});

test("stylesheet wait times out if the browser sends no event", async () => {
  let removed = false;
  let fireTimeout: (() => void) | undefined;
  const link = Object.assign(new EventTarget(), {
    remove() {
      removed = true;
    },
  });
  const restoreDocument = setGlobal("document", {
    head: { appendChild() {} },
    createElement: () => link,
  });
  const restoreTimeout = setGlobal("setTimeout", (callback: () => void) => {
    fireTimeout = callback;
    return 1;
  });
  const restoreClearTimeout = setGlobal("clearTimeout", () => {});

  try {
    const ready = loadStylesheet("chrome-extension://test/assets/content.css");
    fireTimeout?.();
    await assert.rejects(ready, /Unable to load viewer stylesheet/);
    assert.equal(removed, true);
  } finally {
    restoreClearTimeout();
    restoreTimeout();
    restoreDocument();
  }
});

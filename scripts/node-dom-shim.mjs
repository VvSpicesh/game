/**
 * Minimal browser globals so shared/settings.js and audio.js can load under Node.
 * Import this before mahjong modules.
 */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    get length() {
      return map.size;
    }
  };
}

const storage = createMemoryStorage();
const listeners = new Map();

const windowShim = {
  localStorage: storage,
  addEventListener(type, fn) {
    const list = listeners.get(type) || [];
    list.push(fn);
    listeners.set(type, list);
  },
  removeEventListener(type, fn) {
    const list = listeners.get(type) || [];
    listeners.set(
      type,
      list.filter((x) => x !== fn)
    );
  },
  dispatchEvent() {
    return true;
  }
};

const documentShim = {
  addEventListener() {},
  removeEventListener() {},
  body: null,
  documentElement: {}
};

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = storage;
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = windowShim;
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = documentShim;
}
if (typeof globalThis.navigator === "undefined") {
  globalThis.navigator = {userAgent: "nocturne-verify"};
}

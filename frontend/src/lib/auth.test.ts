import test from "node:test";
import assert from "node:assert/strict";
import {
  clearStoredToken,
  getStoredToken,
  getStoredTokenPayload,
  getTokenStorageKey,
  setStoredToken,
  StoredTokenPayload,
} from "./auth";

test("stored token helpers return null or no-op without a browser window", () => {
  removeWindowMock();

  assert.equal(getStoredToken(), null);
  assert.equal(getStoredTokenPayload(), null);
  assert.doesNotThrow(() => setStoredToken("token"));
  assert.doesNotThrow(() => clearStoredToken());
});

test("stored token helpers read, write and clear localStorage", () => {
  const storage = installWindowMock();

  setStoredToken("jwt-token");
  assert.equal(storage.get(getTokenStorageKey()), "jwt-token");
  assert.equal(getStoredToken(), "jwt-token");

  clearStoredToken();
  assert.equal(getStoredToken(), null);

  removeWindowMock();
});

test("getStoredTokenPayload decodes a JWT payload", () => {
  installWindowMock();
  const payload: StoredTokenPayload = {
    sub: "1",
    name: "Maria Silva",
    email: "maria@example.com",
    role: "student",
    iat: 100,
    exp: 200,
  };

  setStoredToken(`header.${toBase64Url(JSON.stringify(payload))}.signature`);

  assert.deepEqual(getStoredTokenPayload(), payload);

  removeWindowMock();
});

test("getStoredTokenPayload returns null for invalid tokens", () => {
  installWindowMock();

  setStoredToken("invalid-token");

  assert.equal(getStoredTokenPayload(), null);

  removeWindowMock();
});

function installWindowMock() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob(value: string) {
        return Buffer.from(value, "base64").toString("binary");
      },
      dispatchEvent() {
        return true;
      },
      localStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        removeItem(key: string) {
          storage.delete(key);
        },
      },
    },
  });

  return storage;
}

function removeWindowMock() {
  Reflect.deleteProperty(globalThis, "window");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

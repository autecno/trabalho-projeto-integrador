const TOKEN_STORAGE_KEY = "autecno.jwt";

export type StoredTokenPayload = {
  sub: string;
  name: string;
  email: string;
  role: "student" | "instructor";
  iat: number;
  exp: number;
};

export function getTokenStorageKey() {
  return TOKEN_STORAGE_KEY;
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredTokenPayload(): StoredTokenPayload | null {
  const token = getStoredToken();
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(paddedPayload)) as StoredTokenPayload;
  } catch {
    return null;
  }
}

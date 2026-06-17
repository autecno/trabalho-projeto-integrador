import test from "node:test";
import assert from "node:assert/strict";
import { getApiUrl } from "./api";

test("getApiUrl returns the configured public API URL", () => {
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";

  assert.equal(getApiUrl(), "https://api.example.com");

  process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
});

test("getApiUrl falls back to the local backend URL", () => {
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;

  assert.equal(getApiUrl(), "http://localhost:3333");

  process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
});

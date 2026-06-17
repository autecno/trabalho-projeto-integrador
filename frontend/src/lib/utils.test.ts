import test from "node:test";
import assert from "node:assert/strict";
import { cn } from "./utils";

test("cn joins truthy class names", () => {
  assert.equal(cn("btn", "btn-primary", "active"), "btn btn-primary active");
});

test("cn ignores false, null and undefined values", () => {
  assert.equal(cn("btn", false, null, undefined, "enabled"), "btn enabled");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs } from "../src/args.js";
import { pkcePair } from "../src/login.js";

test("parses positionals and flags", () => {
  assert.deepEqual(parseArgs(["logs", "shop", "-f", "-n", "500"]), { positionals: ["logs", "shop"], flags: { follow: true, lines: "500" } });
  assert.deepEqual(parseArgs(["env", "set", "A=1", "--target=runtime"]), { positionals: ["env", "set", "A=1"], flags: { target: "runtime" } });
  assert.deepEqual(parseArgs(["deploy", "--app", "shop", "--force"]), { positionals: ["deploy"], flags: { app: "shop", force: true } });
});

test("pkce challenge is the S256 of the verifier", async () => {
  const { createHash } = await import("node:crypto");
  const { verifier, challenge } = pkcePair();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.ok(verifier.length >= 43);
});

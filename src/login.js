import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

import { consoleBase, readConfig, writeConfig } from "./config.js";

const b64url = (buf) => buf.toString("base64url");

export function pkcePair() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* the URL is printed anyway */
  }
}

/** Listens on a random loopback port for the browser's redirect back. */
function startCallbackServer(state) {
  let settle;
  const code = new Promise((resolve, reject) => (settle = { resolve, reject }));
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const got = url.searchParams.get("state") === state ? url.searchParams.get("code") : null;
    res.writeHead(got ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      got
        ? "<h2>Weblines CLI is logged in.</h2><p>You can close this tab and go back to the terminal.</p>"
        : "<h2>Login failed.</h2><p>Go back to the terminal and try again.</p>",
    );
    server.close();
    if (got) settle.resolve(got);
    else settle.reject(new Error(url.searchParams.get("error_description") || url.searchParams.get("error") || "Login was not approved"));
  });
  const timer = setTimeout(() => {
    server.close();
    settle.reject(new Error("Timed out waiting for the browser (5 minutes)"));
  }, 5 * 60_000);
  timer.unref();
  code.finally(() => clearTimeout(timer)).catch(() => {});
  const port = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  return { port, code };
}

/**
 * OAuth for a native app (RFC 8252): register once (DCR), PKCE, loopback
 * redirect on a random port. The person approves in the console; no key to copy.
 */
export async function login({ scope = "read deploy write", print = console.log } = {}) {
  const config = await readConfig();
  const base = consoleBase(config);
  const meta = await fetch(`${base}/.well-known/oauth-authorization-server`).then((r) => {
    if (!r.ok) throw new Error(`Could not reach ${base} (${r.status})`);
    return r.json();
  });

  let clientId = config.console === base ? config.clientId : undefined;
  if (!clientId) {
    const reg = await fetch(meta.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Weblines CLI",
        redirect_uris: ["http://127.0.0.1/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
    const data = await reg.json().catch(() => ({}));
    if (!reg.ok || !data.client_id) throw new Error(`Could not register the CLI: ${data.error_description ?? data.error ?? reg.status}`);
    clientId = data.client_id;
  }

  const { verifier, challenge } = pkcePair();
  const state = b64url(randomBytes(16));
  const callback = startCallbackServer(state);
  const redirectUri = `http://127.0.0.1:${await callback.port}/callback`;
  const authorize = new URL(meta.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  print("Opening your browser to approve the Weblines CLI…");
  print(`If it does not open, visit:\n  ${authorize}`);
  openBrowser(authorize.toString());

  const code = await callback.code;
  const tokenRes = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) throw new Error(`Login failed: ${tokens.error_description ?? tokens.error ?? tokenRes.status}`);
  await writeConfig({ console: base, clientId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, scope: tokens.scope ?? scope });
  return { scope: tokens.scope ?? scope };
}

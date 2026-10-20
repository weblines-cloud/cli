import { consoleBase, readConfig, writeConfig } from "./config.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Calls /api/v1 with WEBLINES_TOKEN (API key, for CI) or the saved login.
 * A saved OAuth login refreshes itself once on 401.
 */
export async function api(method, path, body) {
  const config = await readConfig();
  const base = consoleBase(config);
  const envToken = process.env.WEBLINES_TOKEN;
  let token = envToken || config.accessToken;
  if (!token) throw new ApiError(401, "not_logged_in", "Not logged in. Run `weblines login` (or set WEBLINES_TOKEN).");

  const send = (bearer) =>
    fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        "User-Agent": "weblines-cli/0.1.1",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send(token);
  if (res.status === 401 && !envToken && config.refreshToken) {
    token = await refresh(config, base);
    if (token) res = await send(token);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const error = data.error ?? {};
    const message = error.message ?? `Request failed (${res.status})`;
    const hint = envToken ? "Check the API key in WEBLINES_TOKEN (scopes read and deploy)." : "Run `weblines login` again.";
    throw new ApiError(res.status, error.code ?? "error", res.status === 401 ? `${message}. ${hint}` : message);
  }
  return data;
}

async function refresh(config, base) {
  const res = await fetch(`${base}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refreshToken, client_id: config.clientId }),
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  await writeConfig({ ...config, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? config.refreshToken });
  return tokens.access_token;
}

/** A resource by name or id. */
export async function findResource(nameOrId) {
  const { resources } = await api("GET", "/resources");
  const hit = resources.find((r) => r.id === nameOrId || r.name === nameOrId);
  if (!hit) throw new ApiError(404, "not_found", `No service named "${nameOrId}". Run \`weblines ps\` to see them.`);
  return hit;
}

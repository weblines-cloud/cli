import { api, ApiError, findResource } from "./api.js";
import { clearConfig, consoleBase, readConfig, readLink, writeLink } from "./config.js";
import { login } from "./login.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACTIVE = new Set(["queued", "building"]);

/** The app for a command: explicit name, --app, or the folder's link. */
async function appFrom(name, flags) {
  const pick = name ?? flags.app ?? (await readLink())?.app;
  if (!pick) throw new ApiError(400, "no_app", "Which service? Pass its name, use --app, or run `weblines link <name>` in this folder.");
  return findResource(pick);
}

function table(rows, columns) {
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (cells) => cells.map((cell, i) => String(cell ?? "").padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(columns.map((c) => c.toUpperCase())));
  for (const row of rows) console.log(line(columns.map((c) => row[c])));
}

export const commands = {
  async login(_, flags) {
    const { scope } = await login({ scope: typeof flags.scope === "string" ? flags.scope : undefined });
    console.log(`Logged in (scopes: ${scope}).`);
  },

  async logout() {
    const config = await readConfig();
    if (config.refreshToken && config.clientId) {
      await fetch(`${consoleBase(config)}/api/oauth/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: config.refreshToken, client_id: config.clientId }),
      }).catch(() => {});
    }
    await clearConfig();
    console.log("Logged out.");
  },

  async ps() {
    const { resources } = await api("GET", "/resources");
    if (resources.length === 0) return console.log("No services yet.");
    table(
      resources.map((r) => ({ name: r.name, type: r.type, status: r.status, size: `${r.cpuMillicores / 1000} vCPU / ${r.memoryMb} MB` })),
      ["name", "type", "status", "size"],
    );
  },

  async status([name], flags) {
    const app = await appFrom(name, flags);
    const { resource } = await api("GET", `/resources/${app.id}`);
    console.log(`${resource.name}  ${resource.type}  ${resource.status}`);
    for (const d of resource.domains ?? []) console.log(`  https://${d.hostname}  (ssl ${d.sslStatus})`);
  },

  async link([name]) {
    if (!name) throw new ApiError(400, "usage", "Usage: weblines link <service-name>");
    const app = await findResource(name);
    await writeLink({ app: app.name, id: app.id });
    console.log(`Linked this folder to ${app.name}. Commands now default to it.`);
  },

  async deploy([name], flags) {
    const app = await appFrom(name, flags);
    const started = Date.now();
    await api("POST", `/resources/${app.id}/deployments`, flags.force ? { force: true } : {});
    console.log(`Deploy of ${app.name} started.`);
    if (flags["no-wait"]) return;

    let deployment = null;
    for (let i = 0; i < 40 && !deployment; i++) {
      await sleep(3000);
      const { deployments } = await api("GET", `/resources/${app.id}/deployments`);
      deployment = deployments.find((d) => new Date(d.createdAt).getTime() >= started - 15_000) ?? null;
    }
    if (!deployment) throw new ApiError(504, "timeout", "The deploy did not show up; check it in the console.");

    let printed = 0;
    for (;;) {
      const { deployment: d } = await api("GET", `/resources/${app.id}/deployments/${deployment.id}`);
      const logs = d.logs ?? "";
      if (logs.length > printed) {
        process.stdout.write(logs.slice(printed));
        if (!logs.endsWith("\n")) process.stdout.write("\n");
        printed = logs.length;
      }
      if (!ACTIVE.has(d.status)) {
        console.log(`\nDeploy ${d.status}.`);
        if (d.status !== "finished") process.exitCode = 1;
        return;
      }
      await sleep(3000);
    }
  },

  async logs([name], flags) {
    const app = await appFrom(name, flags);
    const lines = ["100", "500", "2000"].includes(String(flags.lines)) ? String(flags.lines) : "100";
    let seen = new Set();
    for (;;) {
      const { sections } = await api("GET", `/resources/${app.id}/logs?lines=${lines}`);
      const text = sections.map((s) => (s.label ? `--- ${s.label}\n${s.text}` : s.text)).join("\n");
      const rows = text.split("\n").filter(Boolean);
      const fresh = rows.filter((r) => !seen.has(r));
      for (const r of fresh) console.log(r);
      if (!flags.follow) return;
      seen = new Set(rows);
      await sleep(3000);
    }
  },

  async env([sub, ...rest], flags) {
    const vars = rest.filter((a) => a.includes("="));
    const others = rest.filter((a) => !a.includes("="));
    if (sub === "ls" || sub === undefined) {
      const app = await appFrom(others[0], flags);
      const { env } = await api("GET", `/resources/${app.id}/env`);
      if (env.length === 0) return console.log("No variables.");
      table(
        env.map((e) => ({ key: e.key, when: [e.buildtime && "build", e.runtime && "runtime"].filter(Boolean).join("+"), note: e.system ? "system" : e.empty ? "empty" : "" })),
        ["key", "when", "note"],
      );
      console.log("\nValues are never shown here. Set them with `weblines env set KEY=value`.");
      return;
    }
    if (sub === "set") {
      if (vars.length === 0) throw new ApiError(400, "usage", "Usage: weblines env set [service] KEY=value [KEY2=value2 …] [--target both|build|runtime]");
      const app = await appFrom(others[0], flags);
      const body = { vars: Object.fromEntries(vars.map((v) => [v.slice(0, v.indexOf("=")), v.slice(v.indexOf("=") + 1)])) };
      if (typeof flags.target === "string") body.target = flags.target;
      await api("PUT", `/resources/${app.id}/env`, body);
      console.log(`Set ${Object.keys(body.vars).join(", ")} on ${app.name}. Run \`weblines deploy\` for the app to pick them up.`);
      return;
    }
    if (sub === "unset") {
      const [key, appName] = others;
      if (!key) throw new ApiError(400, "usage", "Usage: weblines env unset KEY [service]");
      const app = await appFrom(appName, flags);
      await api("DELETE", `/resources/${app.id}/env/${encodeURIComponent(key)}`);
      console.log(`Removed ${key} from ${app.name}.`);
      return;
    }
    throw new ApiError(400, "usage", "Usage: weblines env ls|set|unset");
  },

  async open([name], flags) {
    const app = await appFrom(name, flags);
    const { resource } = await api("GET", `/resources/${app.id}`);
    const domain = (resource.domains ?? []).find((d) => d.kind !== "platform_default") ?? resource.domains?.[0];
    if (!domain) throw new ApiError(404, "no_domain", `${app.name} has no web address.`);
    console.log(`https://${domain.hostname}`);
  },
};

for (const action of ["start", "stop", "restart"]) {
  commands[action] = async ([name], flags) => {
    const app = await appFrom(name, flags);
    const { resource } = await api("POST", `/resources/${app.id}/${action}`);
    console.log(`${app.name}: ${resource?.status ?? "requested"}. Check with \`weblines status\`.`);
  };
}

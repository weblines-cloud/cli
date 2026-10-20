import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_CONSOLE = "https://console.weblines.ir";

function configPath() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "weblines", "config.json");
}

export async function readConfig() {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch {
    return {};
  }
}

/** Tokens live here, readable only by the user. */
export async function writeConfig(config) {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export async function clearConfig() {
  await rm(configPath(), { force: true });
}

export function consoleBase(config) {
  return (process.env.WEBLINES_URL || config.console || DEFAULT_CONSOLE).replace(/\/+$/, "");
}

/** `weblines link` stores the app for this folder in .weblines.json. */
export async function readLink(cwd = process.cwd()) {
  try {
    return JSON.parse(await readFile(join(cwd, ".weblines.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function writeLink(link, cwd = process.cwd()) {
  await writeFile(join(cwd, ".weblines.json"), JSON.stringify(link, null, 2) + "\n");
}

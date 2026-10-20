#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { parseArgs } from "../src/args.js";
import { commands } from "../src/commands.js";

const HELP = `Weblines CLI — deploy and manage your services on Weblines Cloud

Usage: weblines <command> [service] [options]

  login                 Log in with your browser (no key to copy)
  logout                Log out and revoke this login
  ps                    List services
  status [service]      Status and web address
  link <service>        Use this service by default in this folder
  deploy [service]      Deploy and follow the build log   (--force, --no-wait)
  logs [service]        Recent logs                       (-f to follow, -n 100|500|2000)
  env ls [service]      List variable names
  env set [service] KEY=value …                           (--target both|build|runtime)
  env unset KEY [service]
  start|stop|restart [service]
  open [service]        Print the service's web address

In CI, set WEBLINES_TOKEN to an API key (Settings → API keys) instead of logging in.
Docs: https://weblines.ir/docs/settings/cli`;

const argv = process.argv.slice(2);
const { positionals, flags } = parseArgs(argv);
const [name, ...rest] = positionals;

if (flags.version) {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
} else if (!name || flags.help || name === "help") {
  console.log(HELP);
} else if (!Object.hasOwn(commands, name)) {
  console.error(`Unknown command "${name}". Run \`weblines help\`.`);
  process.exitCode = 2;
} else {
  try {
    await commands[name](rest, flags);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

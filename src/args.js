/** Tiny argv parser: positionals, --flag, --key value, --key=value, -f, -n 100. */
export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("-") && VALUE_FLAGS.has(key)) flags[key] = argv[++i];
      else flags[key] = true;
    } else if (/^-[a-z]$/i.test(arg)) {
      const key = SHORT[arg.slice(1)] ?? arg.slice(1);
      if (VALUE_FLAGS.has(key) && argv[i + 1] !== undefined) flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

const SHORT = { f: "follow", n: "lines", h: "help", v: "version", a: "app" };
const VALUE_FLAGS = new Set(["app", "lines", "target", "console", "scope"]);

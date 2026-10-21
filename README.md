# Weblines CLI

Deploy and manage your services on [Weblines Cloud](https://weblines.ir) from the terminal.

```bash
npm install -g weblines
weblines login          # opens your browser; no key to copy
weblines ps
cd my-app && weblines link my-app
weblines deploy         # starts a deploy and follows the build log
weblines logs -f
```

Requires Node.js 18.17 or newer. No dependencies.

## Commands

| Command | What it does |
|---|---|
| `weblines login` | Log in with your browser (OAuth, PKCE, loopback). Approve the scopes in the console. |
| `weblines logout` | Revoke this login and forget it. |
| `weblines ps` | List services. |
| `weblines status [service]` | Status and web address. |
| `weblines link <service>` | Remember the service for this folder (`.weblines.json`). |
| `weblines deploy [service]` | Deploy and follow the build log until it finishes. `--force` for a build without cache, `--no-wait` to return at once. Exits 1 if the deploy fails. |
| `weblines logs [service]` | Recent runtime logs. `-f` to follow, `-n 100\|500\|2000`. |
| `weblines env ls [service]` | Variable names. Values are never shown. |
| `weblines env set [service] KEY=value …` | Add or change variables (`--target both\|build\|runtime`). Deploy afterwards. |
| `weblines env unset KEY [service]` | Remove a variable. |
| `weblines start\|stop\|restart [service]` | Lifecycle. |
| `weblines open [service]` | Print the web address. |

`[service]` is a name or id; without it, the linked service (or `--app`) is used.

## CI

Don't log in on a CI runner (on GitHub, use [weblines-cloud/deploy-action](https://github.com/weblines-cloud/deploy-action)). Create an API key in **Settings → API keys** (scopes `read` and `deploy`), store it as a secret, and set `WEBLINES_TOKEN`:

```bash
npm install -g https://codeload.github.com/weblines-cloud/cli/tar.gz/v0.1.1
WEBLINES_TOKEN=$WEBLINES_TOKEN weblines deploy my-app
```

## Where things are stored

The login is saved in `~/.config/weblines/config.json` (or `$XDG_CONFIG_HOME/weblines`), readable only by you. `WEBLINES_URL` points the CLI at another console.

---

<div dir="rtl">

## CLI ِ وب‌لاینز

سرویس‌هایتان در [ابر وب‌لاینز](https://weblines.ir) را از ترمینال دیپلوی و مدیریت کنید.

- **نصب:** `npm install -g weblines` (Node.js نسخه‌ی ۱۸.۱۷ یا جدیدتر).
- **ورود:** `weblines login` مرورگر را باز می‌کند؛ در کنسول تأیید کنید. کلیدی کپی نمی‌شود.
- **دیپلوی:** در پوشه‌ی پروژه یک بار `weblines link نام-سرویس`، بعد هر بار `weblines deploy`؛ لاگِ build تا پایان نشان داده می‌شود.
- **لاگ:** `weblines logs -f`
- **متغیرها:** `weblines env set KEY=value` و بعد `weblines deploy`. مقدارِ متغیرها هیچ‌وقت نمایش داده نمی‌شود.
- **CI:** به‌جای ورود، یک کلیدِ API با دسترسیِ `read` و `deploy` بسازید و در `WEBLINES_TOKEN` بگذارید.

</div>

# Immich Deck — Row 1: Monitoring

Stream Deck plugin turning the top row into a live Immich dashboard. No computer
screen needed — all feedback is rendered on the key faces.

## Keys in this build

| Key | What it shows | Colors |
|---|---|---|
| Server Health | Online / Down light via `/api/server/ping` | green / red |
| Asset Count | Total assets + photo/video split | — |
| Storage Used | % used with gauge bar | green <75%, amber <90%, red ≥90% |
| Active Jobs | Running count, queued + failed | blue when busy, red on failures |
| CPU / RAM | Host stats via a Glances endpoint | amber/red thresholds |

Pressing any key forces an immediate refresh. Keys poll on the interval set in
settings (default 30s).

## Build & install

Requires Node.js 24+ (build only — use Docker) and the Stream Deck app 7.1+.

```bash
npm install
npm install -g @elgato/cli   # if you don't have it
npm run build                # compiles src/ -> com.immichdeck.panel.sdPlugin/bin/plugin.js
streamdeck link com.immichdeck.panel.sdPlugin
streamdeck restart com.immichdeck.panel
```

For iterating: `npm run watch` rebuilds and restarts the plugin on every save.

## Configure

1. Drag any Immich Deck key onto the deck, click it in the app once to open its
   settings panel (you only need the screen for this one-time setup).
2. Set **Server URL** (e.g. `http://192.168.1.50:2283`) and **API key**.
   Create the key in Immich under Account Settings → API Keys — it must belong
   to an **admin** user for the statistics endpoint.
3. Settings are global: all five keys share them.

### CPU / RAM key

Immich's API doesn't expose host resources, so this key reads from
[Glances](https://github.com/nicolargo/glances) on the server:

```bash
docker run -d --restart=always --name glances -p 61208:61208 --pid host \
  nicolargo/glances:latest -w
```

Then set **Glances URL** to `http://<server-ip>:61208`.

## API version note

The client tries modern paths (`/api/server/...`) and falls back to legacy ones
(`/api/server-info/...`), covering Immich ≥ ~1.100. If a key shows `ERR`,
check your instance's live spec at `http://<server>:2283/api/docs` and adjust
paths in `src/immich-client.ts`.

## Next rows

Row 2 (Docker start/stop/restart/update/status) and Row 3 (backups, library
scan, cleanup, safe shutdown) plug into the same skeleton: each will be another
action class, with SSH/exec instead of HTTP, and hold-to-confirm on destructive
keys.

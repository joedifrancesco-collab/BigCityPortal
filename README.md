# Big City Portal (BCP)

A personal homepage, in the spirit of iGoogle. It runs locally, with no third-party hosting and no dependencies beyond Node.js.

## Features

- Quick launch tiles for web apps (any URL) and a fixed set of Windows apps (Calculator, Notepad, Paint, Snipping Tool, File Explorer, Task Manager); click Edit to add or remove
- Search bar (Google, Bing, DuckDuckGo)
- Bookmarks, with import from Chrome/Edge (Bookmarks manager -> ... -> Export bookmarks, then click Import)
- Drag widgets by their title to reorder them (order is saved)
- Weather and 5-day forecast ([Open-Meteo](https://open-meteo.com/), no API key)
- RSS feeds, each collapsible (collapsed state is remembered, and collapsed feeds are not fetched until opened)
- Notes
- Light/dark theme

## Requirements

- [Node.js](https://nodejs.org/) 18 or later

## Run

```
node server.js
```

Then open <http://localhost:3000>. On Windows you can also run `start-bcp.cmd`, which starts the server minimized.

To use it as your homepage, set Chrome or Edge's homepage to `http://localhost:3000`. To start the server at login, put a shortcut to `start-bcp.cmd` in `shell:startup`.

Set `BCP_PORT` to use a different port.

## How it works

- `server.js` serves `public/`, proxies RSS feeds at `/api/rss` (browsers block most direct feed requests), and stores settings at `/api/config`.
- Settings are saved to `data/config.json`, which is git-ignored. Keep the project in OneDrive to sync it between computers.
- The server listens on `127.0.0.1` only. It rejects RSS requests to private addresses and API calls from other origins.
- Windows apps are launched through POST /api/launch using ids from a fixed allowlist in server.js (the browser never sends a command). To offer another app, add it to APPS there.

## Project layout

```
server.js            local server (static files, RSS proxy, config API)
public/index.html    page shell
public/style.css     styles
public/js/           app, config, and widgets (bookmarks, weather, rss, notes)
data/                saved settings (git-ignored)
```

## License

Apache 2.0, see [LICENSE](LICENSE).




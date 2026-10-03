# Big City Portal (BCP)

A personal homepage, in the spirit of iGoogle. It is a plain HTML/CSS/JavaScript page with no server, no build step and no dependencies.

## Features

- Search bar (Google, Bing, DuckDuckGo), results open in a new tab
- Quick launch tiles for your favorite web apps (click Edit to add or remove)
- Bookmarks shown as collapsible folders (folders first, then loose bookmarks), with an **Edit** button that reveals the delete buttons (on bookmarks and folders, where deleting a folder removes everything in it) and **Remove all**; long titles are truncated. Import from Chrome/Edge keeps your folder structure: Bookmarks manager â†’ â‹® â†’ Export bookmarks, then click Import.
- Weather and 5-day forecast ([Open-Meteo](https://open-meteo.com/), no API key)
- Notes
- News headlines from Hacker News or Wikipedia's In the news (sources that allow direct browser access; no key or proxy)
- Clock (12h/24h toggle)
- Calendar with today highlighted and month/year navigation
- Drag widgets by their title to reorder them
- Light/dark theme

## Use

Open `index.html` in Chrome or Edge, or double-click it. To make it your homepage, set the browser's homepage (Settings â†’ On startup / Home button) to the file's address, for example `file:///C:/Users/you/OneDrive/Documents/Development/Source/Repos/BigCityPortal/index.html`.

## Settings

Settings are saved in your browser's local storage, so they stay with that browser, profile and file location. They do not sync automatically. To move them to another browser or computer, click **Export** in the header, then **Import** on the other one. Imported files are validated and unknown fields are ignored.

## Files

```
index.html   page shell
style.css    styles
app.js       all the logic (a classic script, so it works from file://)
```

## License

Apache 2.0, see [LICENSE](LICENSE).

# Big City Portal (BCP)

A personal homepage, in the spirit of iGoogle. It is a plain HTML/CSS/JavaScript page with no server, no build step and no dependencies.

## Features

- Search bar (Google, Bing, DuckDuckGo), results open in a new tab
- Quick launch tiles for your favorite web apps (click Edit to add or remove)
- Bookmarks shown as collapsible folders (folders first, then loose bookmarks), with an **Edit** button that reveals the delete buttons (on bookmarks and folders, where deleting a folder removes everything in it) and **Remove all**; long titles are truncated. Import from Chrome/Edge keeps your folder structure: Bookmarks manager â†’ â‹® â†’ Export bookmarks, then click Import.
- Weather and 5-day forecast ([Open-Meteo](https://open-meteo.com/), no API key)
- Notes
- News: RSS feeds you choose (BBC, NPR and NBC by default), each collapsible; Edit to add or remove feeds. Headlines are fetched through the free third-party [rss2json](https://rss2json.com/) service, which sees the feed URLs you read (and your IP address). Nothing else is sent.
- Stocks: quotes for the symbols you choose, via [Finnhub](https://finnhub.io/) (free API key required; paste it under Edit). Company names are shown under each symbol. The free plan has no index symbols, so use the tracking ETFs: SPY (S&P 500), ONEQ (Nasdaq Composite), QQQ (Nasdaq-100), DIA (Dow Jones). The key is stored only in this browser's localStorage and is included in Export, so don't share exported files.
- Scores: live and recent scores for NFL, NBA, MLB, NHL, WNBA, college, MLS and Premier League, from ESPN's public scoreboard feed (no key).
- Tall sections (Notes, Bookmarks, News, Stocks, Scores) stop at the height of the Weather widget; a Show more / Show less bar appears when there is more to see.
- Clock (12h/24h toggle)
- Calendar with today highlighted and month/year navigation
- Jotform Dino Game widget embedded from Jotform; its third-party script contacts Jotform when the page loads
- Drag widgets by their title to reorder them, between the three columns or into the double-width row above them (the Jotform widget lives there by default)
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

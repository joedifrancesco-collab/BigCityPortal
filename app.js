(function () {
  'use strict';

  const STORAGE_KEY = 'bcp-config';
  const COLUMNS = 3;
  const CAPPED = new Set(['notes', 'bookmarks', 'news', 'stocks', 'sports', 'jotform']);
  const LEAGUES = {
    nfl: ['NFL', 'football/nfl'], nba: ['NBA', 'basketball/nba'], mlb: ['MLB', 'baseball/mlb'], nhl: ['NHL', 'hockey/nhl'],
    wnba: ['WNBA', 'basketball/wnba'], cfb: ['College Football', 'football/college-football'],
    ncaam: ["Men's College Basketball", 'basketball/mens-college-basketball'], mls: ['MLS', 'soccer/usa.1'], epl: ['Premier League', 'soccer/eng.1'],
  };
  const LEAGUE_IDS = Object.keys(LEAGUES);
  const DEFAULTS = {
    theme: 'dark',
    engine: 'Google',
    engines: {
      Google: 'https://www.google.com/search?q=',
      Bing: 'https://www.bing.com/search?q=',
      DuckDuckGo: 'https://duckduckgo.com/?q=',
    },
    bookmarks: [
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'Outlook', url: 'https://outlook.office.com' },
      { title: 'Gmail', url: 'https://mail.google.com' },
    ],
    quicklaunch: [
      { title: 'Gmail', url: 'https://mail.google.com' },
      { title: 'Calendar', url: 'https://calendar.google.com' },
      { title: 'Drive', url: 'https://drive.google.com' },
      { title: 'Outlook', url: 'https://outlook.office.com' },
    ],
    weather: { name: 'New York', lat: 40.71, lon: -74.01, unit: 'fahrenheit' },
    notes: '',
    feeds: [
      { title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
      { title: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
      { title: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
    ],
    clock24: false,
    stocks: { key: '', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'], names: {} },
    sports: { league: 'nfl' },
    columns: [['notes', 'weather'], ['bookmarks'], ['calendar']],
  };

  // ---------- helpers ----------
  const isHttp = u => /^https?:\/\//i.test(u);
  const safeUrl = u => (isHttp(u) ? u : '#');
  // Widget title that opens the related site in a new tab (not draggable, so the header can still drag the widget)
  const titleLink = (text, url) => h('a', { class: 'title-link', href: url, target: '_blank', rel: 'noopener', draggable: 'false', title: 'Open ' + url.replace(/^https:\/\/(www\.)?/, '') }, text, ' \u2197');

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('on')) el[k] = v;
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    el.append(...children.filter(c => c != null));
    return el;
  }

  // ---------- bookmark tree helpers ----------
  // A node is either { title, url } or a folder { title, children: [...] }.
  const MAX_DEPTH = 12;
  const isFolder = n => Array.isArray(n.children);

  function cleanNodes(list, depth) {
    return list.map(n => {
      if (!n || typeof n.title !== 'string') return null;
      if (Array.isArray(n.children) && depth < MAX_DEPTH) return { title: n.title, children: cleanNodes(n.children, depth + 1) };
      if (typeof n.url === 'string' && isHttp(n.url)) return { title: n.title, url: n.url };
      return null;
    }).filter(Boolean);
  }

  // Adds node under the folder path (creating or reusing folders by name); skips an identical URL in that folder.
  function insertAt(tree, path, node) {
    let list = tree;
    for (const name of path) {
      let folder = list.find(n => isFolder(n) && n.title === name);
      if (!folder) { folder = { title: name, children: [] }; list.push(folder); }
      list = folder.children;
    }
    if (node && !(node.url && list.some(n => n.url === node.url))) { list.push(node); return true; }
    return false;
  }

  const countLinks = list => list.reduce((n, b) => n + (isFolder(b) ? countLinks(b.children) : 1), 0);

  // ---------- config (browser localStorage) ----------
  // Keeps only the fields BCP uses and validates their shapes, so imported files can't break the page.
  function normalize(raw) {
    const c = structuredClone(DEFAULTS);
    if (!raw || typeof raw !== 'object') return c;
    const str = v => typeof v === 'string';
    if (raw.theme === 'dark' || raw.theme === 'light') c.theme = raw.theme;
    if (raw.engines && typeof raw.engines === 'object') {
      const e = Object.fromEntries(Object.entries(raw.engines).filter(([k, v]) => str(v) && isHttp(v)));
      if (Object.keys(e).length) c.engines = e;
    }
    c.engine = str(raw.engine) && c.engines[raw.engine] ? raw.engine : Object.keys(c.engines)[0];
    const links = list => Array.isArray(list)
      ? list.filter(b => b && str(b.title) && str(b.url) && isHttp(b.url)).map(b => ({ title: b.title, url: b.url }))
      : null;
    c.quicklaunch = links(raw.quicklaunch) ?? c.quicklaunch;
    if (Array.isArray(raw.bookmarks)) {
      c.bookmarks = cleanNodes(raw.bookmarks, 0);
      // Older versions stored a flat list with a "Parent / Child" folder string
      const legacy = raw.bookmarks.filter(b => b && !Array.isArray(b.children) && str(b.folder) && b.folder);
      c.bookmarks = c.bookmarks.filter(n => !n.url || !legacy.some(b => b.url === n.url && b.title === n.title));
      for (const b of legacy) if (str(b.title) && isHttp(b.url)) insertAt(c.bookmarks, b.folder.split(' / '), { title: b.title, url: b.url });
    }
    const w = raw.weather;
    if (w && str(w.name) && Number.isFinite(w.lat) && Number.isFinite(w.lon)) {
      c.weather = { name: w.name, lat: w.lat, lon: w.lon, unit: w.unit === 'celsius' ? 'celsius' : 'fahrenheit' };
    }
    if (str(raw.notes)) c.notes = raw.notes;
    c.feeds = links(raw.feeds) ?? c.feeds;
    if (typeof raw.clock24 === 'boolean') c.clock24 = raw.clock24;
    const s = raw.stocks;
    if (s && Array.isArray(s.symbols)) {
      c.stocks = { key: str(s.key) ? s.key.slice(0, 100) : '', symbols: [...new Set(s.symbols.filter(x => str(x) && /^[A-Z0-9.\-]{1,10}$/.test(x)))]      .slice(0, 20), names: {} };
            if (s.names && typeof s.names === 'object') for (const k of c.stocks.symbols) if (str(s.names[k])) c.stocks.names[k] = s.names[k].slice(0, 80);
          }
    if (raw.sports && LEAGUE_IDS.includes(raw.sports.league)) c.sports = { league: raw.sports.league };
    if (Array.isArray(raw.columns) && raw.columns.length) {
      c.columns = raw.columns.slice(0, COLUMNS).map(col => Array.isArray(col) ? col.filter(str) : []);
      while (c.columns.length < COLUMNS) c.columns.push([]);
    } else if (Array.isArray(raw.order)) { // older single-list layout: deal widgets across the columns
      c.columns = Array.from({ length: COLUMNS }, () => []);
      raw.order.filter(str).forEach((id, i) => c.columns[i % COLUMNS].push(id));
    }
    return c;
  }

  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return normalize(null); }
  }

  let config = load();
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* storage unavailable */ }
  };

  // ---------- header: theme, clock, export/import ----------
  const applyTheme = () => { document.documentElement.dataset.theme = config.theme; };
  applyTheme();
  document.getElementById('theme-toggle').onclick = () => {
    config.theme = config.theme === 'dark' ? 'light' : 'dark';
    applyTheme(); save();
  };

  const clock = document.getElementById('clock');
  const tick = () => {
    clock.textContent = new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 15000);

  document.getElementById('settings-export').onclick = () => {
    const a = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })),
      download: 'bcp-settings.json',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const settingsFile = document.getElementById('settings-file');
  document.getElementById('settings-import').onclick = () => settingsFile.click();
  settingsFile.onchange = async () => {
    const file = settingsFile.files[0];
    settingsFile.value = '';
    if (!file) return;
    try {
      config = normalize(JSON.parse(await file.text()));
      save();
      location.reload();
    } catch { alert('That file is not a valid BCP settings file.'); }
  };

  // ---------- search ----------
  const engine = document.getElementById('engine');
  for (const name of Object.keys(config.engines)) engine.add(new Option(name, name, false, name === config.engine));
  engine.onchange = () => { config.engine = engine.value; save(); };
  document.getElementById('search').onsubmit = e => {
    e.preventDefault();
    const q = document.getElementById('q').value.trim();
    if (q) window.open(config.engines[engine.value] + encodeURIComponent(q), '_blank', 'noopener');
  };

  // ---------- quick launch ----------
  function quicklaunch(root) {
    let editing = false;
    const hostOf = u => { try { return new URL(u).hostname; } catch { return ''; } };

    const icon = item => {
      const letter = h('span', { class: 'ql-icon' }, (item.title[0] || '?').toUpperCase());
      const img = h('img', { class: 'ql-icon', alt: '', src: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(item.url))}` });
      img.onerror = () => img.replaceWith(letter);
      return img;
    };

    const tile = (item, i) => {
      const el = h('a', { class: 'ql-tile', href: safeUrl(item.url), target: '_blank', rel: 'noopener' }, icon(item), h('span', {}, item.title));
      if (!editing) return el;
      el.style.pointerEvents = 'none';
      const remove = h('button', { class: 'ql-remove', title: 'Remove', onclick: () => { config.quicklaunch.splice(i, 1); save(); render(); } }, '✕');
      return h('div', { class: 'ql-wrap' }, el, remove);
    };

    const render = () => {
      const edit = h('button', { class: 'ql-edit-btn', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit');
      const parts = [h('div', { class: 'ql-tiles' }, ...config.quicklaunch.map(tile), edit)];
      if (editing) {
        const title = h('input', { placeholder: 'Title' });
        const url = h('input', { placeholder: 'https://…' });
        parts.push(h('div', { class: 'row ql-edit' }, title, url, h('button', { onclick: () => {
          if (!title.value.trim() || !isHttp(url.value.trim())) return;
          config.quicklaunch.push({ title: title.value.trim(), url: url.value.trim() });
          save(); render();
        } }, 'Add')));
      }
      root.replaceChildren(...parts);
    };
    render();
  }

  // ---------- bookmarks (folders, with Chrome/Edge HTML import) ----------
  // Parses a Chrome/Edge "Export bookmarks" HTML file (Netscape format) into [{ path: [...folders], node }] in file order.
  // Root folders ("Bookmarks bar", "Favorites bar", "Other bookmarks") are kept; items outside any root go under "Other bookmarks".
  function parseBookmarkFile(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const isRoot = h3 => h3.hasAttribute('personal_toolbar_folder') || h3.hasAttribute('unfiled_bookmarks_folder');
    const pathOf = el => {
      const path = [];
      let rooted = false;
      for (let dl = el.closest('dl'); dl; dl = dl.parentElement?.closest('dl')) {
        const head = dl.previousElementSibling;
        if (head?.tagName === 'H3' && head.textContent.trim()) {
          path.unshift(head.textContent.trim());
          if (isRoot(head)) rooted = true;
        }
      }
      return rooted ? path : ['Other bookmarks', ...path];
    };
    const found = [];
    for (const el of doc.querySelectorAll('h3, a[href]')) {
      if (el.tagName === 'H3') {
        const name = el.textContent.trim();
        if (!name) continue;
        const parent = pathOf(el);
        found.push({ path: isRoot(el) ? [name] : [...parent, name], node: null });
        continue;
      }
      const url = el.getAttribute('href').trim();
      if (isHttp(url)) found.push({ path: pathOf(el), node: { title: el.textContent.trim() || url, url } });
    }
    return found;
  }

  function bookmarks(root) {
    let message = '';
    const open = new Set(); // folder paths left expanded across re-renders
    const key = path => path.join('\u0000');

    const removeAt = (list, node) => { list.splice(list.indexOf(node), 1); save(); render(); };

    const MAX_TITLE = 60;
    const short = s => s.length > MAX_TITLE ? s.slice(0, MAX_TITLE - 1) + '\u2026' : s;
    let editing = false; // delete buttons are only shown in edit mode

    const bookmarkRow = (b, list) => h('li', {},
      h('a', { href: safeUrl(b.url), target: '_blank', rel: 'noopener', title: b.title }, short(b.title)),
      editing ? h('button', { class: 'x', title: 'Remove', onclick: () => removeAt(list, b) }, '\u2715') : null);

    // Folders first, then individual bookmarks
    const renderList = (list, path) => {
      const folders = list.filter(isFolder).map(f => folderEl(f, list, [...path, f.title]));
      const items = list.filter(n => !isFolder(n)).map(b => bookmarkRow(b, list));
      return h('ul', { class: 'bm-list' }, ...folders, ...items);
    };

    const folderEl = (f, parent, path) => {
      const remove = h('button', { class: 'x', title: 'Delete folder and its contents', onclick: e => {
        e.preventDefault(); e.stopPropagation();
        const n = countLinks(f.children);
        if (confirm(`Delete the folder "${f.title}" and ${n} bookmark${n === 1 ? '' : 's'} inside it?`)) removeAt(parent, f);
      } }, '\u2715');
      const d = h('details', { class: 'bm-folder' },
        h('summary', {}, h('span', { class: 'bm-name', title: f.title }, `\u{1F4C1} ${short(f.title)}`), h('span', { class: 'muted' }, String(countLinks(f.children))), editing ? remove : null),
        renderList(f.children, path));
      d.open = open.has(key(path));
      d.addEventListener('toggle', () => { if (d.open) open.add(key(path)); else open.delete(key(path)); });
      return h('li', { class: 'bm-folder-item' }, d);
    };

    const importFile = async file => {
      try {
        const parsed = parseBookmarkFile(await file.text());
        let added = 0;
        for (const { path, node } of parsed) if (insertAt(config.bookmarks, path, node) && node) added++;
        const links = parsed.filter(p => p.node).length;
        save();
        message = `Imported ${added} bookmark${added === 1 ? '' : 's'}` + (links - added ? `, skipped ${links - added} duplicates` : '');
      } catch { message = 'Could not read that file'; }
      render();
    };

    const render = () => {
      const title = h('input', { placeholder: 'Title' });
      const url = h('input', { placeholder: 'https://\u2026' });
      const add = h('button', { onclick: () => {
        if (!title.value.trim() || !isHttp(url.value.trim())) return;
        config.bookmarks.push({ title: title.value.trim(), url: url.value.trim() });
        message = '';
        save(); render();
      } }, 'Add');

      const picker = h('input', { type: 'file', accept: '.html,text/html', hidden: '' });
      picker.onchange = () => picker.files[0] && importFile(picker.files[0]);
      const importBtn = h('button', { title: 'In Chrome/Edge: Bookmarks manager \u2192 \u22EE \u2192 Export bookmarks', onclick: () => picker.click() }, 'Import');
      const removeAll = h('button', { title: 'Delete all bookmarks and folders', onclick: () => {
        const n = countLinks(config.bookmarks);
        if (!n && !config.bookmarks.length) return;
        if (!confirm(`Delete all ${n} bookmark${n === 1 ? '' : 's'} and folders? This cannot be undone.`)) return;
        config.bookmarks = []; open.clear(); message = ''; save(); render();
      } }, 'Remove all');

      const editBtn = h('button', { title: 'Show delete buttons', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit');

      root.replaceChildren(
        h('h2', {}, 'Bookmarks', h('span', { class: 'btns' }, editing ? removeAll : null, importBtn, editBtn)),
        renderList(config.bookmarks, []),
        h('div', { class: 'row' }, title, url, add), picker,
        h('div', { class: 'muted' }, message));
    };
    render();
  }

  // ---------- weather (Open-Meteo, no API key) ----------
  const WEATHER_CODES = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle',
    55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
  };

  function weather(root) {
    const w = config.weather;
    const body = h('div', { class: 'muted' }, 'Loading…');
    const place = h('input', { placeholder: 'Change city…' });
    const status = h('div', { class: 'muted' });
    const change = h('button', { onclick: async () => {
      const q = place.value.trim();
      if (!q) return;
      try {
        const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`)).json();
        if (!r.results?.length) { status.textContent = 'City not found'; return; }
        const c = r.results[0];
        Object.assign(w, { name: c.name, lat: c.latitude, lon: c.longitude });
        save(); place.value = ''; status.textContent = ''; refresh();
      } catch { status.textContent = 'Lookup failed'; }
    } }, 'Set');
    const unit = h('button', { onclick: () => { w.unit = w.unit === 'fahrenheit' ? 'celsius' : 'fahrenheit'; save(); refresh(); } }, '°F/°C');
    root.replaceChildren(h('h2', {}, titleLink('Weather', 'https://weather.com'), unit), body, h('div', { class: 'row' }, place, change), status);

    async function refresh() {
      try {
        const f = w.unit === 'fahrenheit';
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}` +
          `&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code` +
          `&timezone=auto&temperature_unit=${w.unit}&wind_speed_unit=${f ? 'mph' : 'kmh'}`;
        const d = await (await fetch(u)).json();
        const sym = f ? '°F' : '°C';
        const days = d.daily.time.slice(0, 5).map((t, i) => h('li', {},
          h('span', {}, new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' })),
          h('span', { class: 'muted' }, WEATHER_CODES[d.daily.weather_code[i]] ?? ''),
          h('span', {}, `${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°`)));
        body.className = '';
        body.replaceChildren(
          h('div', {}, h('span', { class: 'big' }, `${Math.round(d.current.temperature_2m)}${sym}`), ` ${w.name}`),
          h('div', { class: 'muted' }, `${WEATHER_CODES[d.current.weather_code] ?? ''} · Wind ${Math.round(d.current.wind_speed_10m)} ${f ? 'mph' : 'km/h'}`),
          h('ul', {}, ...days));
      } catch { body.textContent = 'Weather unavailable'; }
    }
    refresh();
  }

  // ---------- notes ----------
  function notes(root) {
    const area = h('textarea', { placeholder: 'Quick notes…' });
    area.value = config.notes;
    area.oninput = () => { config.notes = area.value; save(); };
    root.replaceChildren(h('h2', {}, 'Notes'), area);
  }

  // ---------- news: RSS feeds via rss2json (a free third-party service that makes feeds readable from a local page) ----------
  const RSS_API = 'https://api.rss2json.com/v1/api.json?rss_url=';
  // Feed text may contain entities or tags; read it as plain text and never insert it as markup
  const plain = s => new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim();

  function news(root) {
    const open = new Set(config.feeds.slice(0, 1).map(f => f.url)); // first feed starts expanded
    const cache = new Map(); // feed url -> { items } | { error } | { loading }
    let editing = false;

    const load = async feed => {
      if (cache.has(feed.url)) return;
      cache.set(feed.url, { loading: true });
      try {
        const data = await (await fetch(RSS_API + encodeURIComponent(feed.url))).json();
        if (data.status !== 'ok') throw new Error(data.message || 'feed error');
        const items = (data.items || []).map(i => ({ title: plain(i.title), url: i.link })).filter(i => i.title && isHttp(i.url || ''));
        cache.set(feed.url, items.length ? { items } : { error: 'No headlines in this feed' });
      } catch {
        cache.set(feed.url, { error: 'Could not load this feed' });
      }
      render();
    };

    const feedEl = feed => {
      const state = cache.get(feed.url);
      const remove = h('button', { class: 'x', title: 'Remove feed', onclick: e => {
        e.preventDefault(); e.stopPropagation();
        config.feeds = config.feeds.filter(f => f !== feed); open.delete(feed.url); cache.delete(feed.url); save(); render();
      } }, '\u2715');
      let body;
      if (state?.items) body = h('ul', { class: 'news-list' }, ...state.items.map(i => h('li', {}, h('a', { href: safeUrl(i.url), target: '_blank', rel: 'noopener' }, i.title))));
      else body = h('div', { class: 'muted news-status' }, state?.error || 'Loading\u2026');
      const d = h('details', { class: 'bm-folder news-feed' },
        h('summary', {}, h('span', { class: 'bm-name', title: feed.url }, feed.title), editing ? remove : null), body);
      d.open = open.has(feed.url);
      d.addEventListener('toggle', () => {
        if (d.open) { open.add(feed.url); load(feed); } else open.delete(feed.url);
      });
      return d;
    };

    const render = () => {
      const name = h('input', { placeholder: 'Name' });
      const url = h('input', { placeholder: 'Feed URL (https://\u2026)' });
      const add = h('button', { onclick: () => {
        if (!name.value.trim() || !isHttp(url.value.trim())) return;
        config.feeds.push({ title: name.value.trim(), url: url.value.trim() });
        open.add(url.value.trim()); save(); render();
      } }, 'Add');
      const edit = h('button', { title: 'Add or remove feeds', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit');
      const refresh = h('button', { title: 'Reload headlines', onclick: () => { cache.clear(); render(); } }, '\u21BB');

      root.replaceChildren(...[
        h('h2', {}, 'News', h('span', { class: 'btns' }, refresh, edit)),
        config.feeds.length ? h('div', {}, ...config.feeds.map(feedEl)) : h('div', { class: 'muted' }, 'No feeds yet. Click Edit to add one.'),
        editing ? h('div', { class: 'row' }, name, url, add) : null,
      ].filter(Boolean));
      // Fetch only feeds that are expanded and not loaded yet
      for (const f of config.feeds) if (open.has(f.url) && !cache.has(f.url)) load(f);
    };
    render();
  }

  // ---------- stocks: quotes from Finnhub (needs a free API key, stored only in this browser) ----------
  function stocks(root) {
    const quotes = new Map(); // symbol -> { c, d, dp } | { error }
    let editing = false, loaded = false;

    // Finnhub's free plan has no index symbols, so indexes are shown through the ETFs that track them
    const FIXED = { SPY: 'S&P 500 (SPDR ETF)', ONEQ: 'Nasdaq Composite (Fidelity ETF)', QQQ: 'Nasdaq-100 (Invesco ETF)', DIA: 'Dow Jones Industrial Average (SPDR ETF)' };
    const nameOf = sym => FIXED[sym] || config.stocks.names[sym] || '';
    const lookupName = async sym => {
      if (nameOf(sym)) return;
      try {
        const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(sym)}&token=${encodeURIComponent(config.stocks.key)}`);
        const m = (await r.json()).result?.find(x => x.symbol === sym);
        if (m?.description) { config.stocks.names[sym] = plain(m.description).slice(0, 80); save(); }
      } catch { /* the name is optional */ }
    };

    const load = async () => {
      loaded = true;
      if (!config.stocks.key) return;
      await Promise.all(config.stocks.symbols.map(async sym => {
        lookupName(sym).then(render);
        try {
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(config.stocks.key)}`);
          if (!r.ok) throw new Error(r.status);
          const q = await r.json();
          quotes.set(sym, q.c ? { c: q.c, d: q.d, dp: q.dp } : { error: 'Unknown symbol' });
        } catch (e) {
          quotes.set(sym, { error: String(e.message) === '401' || String(e.message) === '403' ? 'Check API key' : 'Unavailable' });
        }
      }));
      render();
    };

    const row = sym => {
      const q = quotes.get(sym);
      let val;
      if (q?.error) val = h('span', { class: 'muted' }, q.error);
      else if (q) {
        const up = q.d >= 0;
        val = h('span', { class: 'stock-val' }, q.c.toFixed(2), ' ',
          h('span', { class: up ? 'up' : 'down' }, `${up ? '\u25B2' : '\u25BC'} ${Math.abs(q.d).toFixed(2)} (${Math.abs(q.dp).toFixed(2)}%)`));
      } else val = h('span', { class: 'muted' }, config.stocks.key ? '\u2026' : '');
      const x = h('button', { class: 'x', title: 'Remove', onclick: () => {
        config.stocks.symbols = config.stocks.symbols.filter(s => s !== sym); quotes.delete(sym); save(); render();
      } }, '\u2715');
      return h('li', { class: 'stock-row' }, h('div', { class: 'stock-id' }, h('strong', {}, sym), nameOf(sym) ? h('div', { class: 'muted stock-name', title: nameOf(sym) }, nameOf(sym)) : null), val, editing ? x : null);
    };

    const render = () => {
      const edit = h('button', { title: 'Edit symbols and API key', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit');
      const refresh = h('button', { title: 'Refresh quotes', onclick: () => { quotes.clear(); loaded = false; render(); } }, '\u21BB');
      const key = h('input', { type: 'password', placeholder: 'Finnhub API key', value: config.stocks.key });
      const saveKey = h('button', { onclick: () => { config.stocks.key = key.value.trim(); quotes.clear(); loaded = false; save(); render(); } }, 'Save key');
      const sym = h('input', { placeholder: 'Symbol, e.g. AAPL' });
      const add = h('button', { onclick: () => {
        const s = sym.value.trim().toUpperCase();
        if (!/^[A-Z0-9.\-]{1,10}$/.test(s) || config.stocks.symbols.includes(s)) return;
        config.stocks.symbols.push(s); save(); loaded = false; render();
      } }, 'Add');
      root.replaceChildren(...[
        h('h2', {}, titleLink('Stocks', 'https://finance.yahoo.com'), h('span', { class: 'btns' }, refresh, edit)),
        !config.stocks.key
          ? h('div', { class: 'muted' }, 'Quotes need a free API key from finnhub.io. Click Edit to paste it.')
          : h('ul', { class: 'stock-list' }, ...config.stocks.symbols.map(row)),
        editing ? h('div', { class: 'row' }, key, saveKey) : null,
        editing ? h('div', { class: 'row' }, sym, add) : null,
        h('div', { class: 'muted news-status' }, 'Quotes may be delayed.'),
      ].filter(Boolean));
      if (!loaded) load();
    };
    render();
  }

  // ---------- sports: scores from ESPN's public scoreboard feed ----------

  function sports(root) {
    let state = { loading: true };
    let seq = 0;

    const load = async () => {
      const mine = ++seq;
      state = { loading: true }; render();
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[config.sports.league][1]}/scoreboard`);
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        const games = (data.events || []).map(e => {
          const comp = e.competitions?.[0];
          const t = side => {
            const c = comp?.competitors?.find(x => x.homeAway === side);
            return { name: plain(c?.team?.abbreviation || c?.team?.shortDisplayName || '?'), score: c?.score };
          };
          return { away: t('away'), home: t('home'), status: plain(e.status?.type?.shortDetail), st: e.status?.type?.state, url: e.links?.[0]?.href };
        });
        if (mine === seq) state = { games };
      } catch {
        if (mine === seq) state = { error: 'Could not load scores' };
      }
      if (mine === seq) render();
    };

    const gameEl = g => {
      const started = g.st === 'in' || g.st === 'post';
      const line = (t, win) => h('div', { class: 'team' + (win ? ' win' : '') }, h('span', {}, t.name), h('span', {}, started ? String(t.score ?? '') : ''));
      const a = Number(g.away.score), b = Number(g.home.score);
      const done = g.st === 'post';
      const body = h('div', { class: 'game' + (g.st === 'in' ? ' live' : '') },
        h('div', { class: 'teams' }, line(g.away, done && a > b), line(g.home, done && b > a)),
        h('div', { class: 'muted game-status' }, g.status));
      return h('li', {}, isHttp(g.url || '') ? h('a', { href: g.url, target: '_blank', rel: 'noopener', class: 'game-link' }, body) : body);
    };

    const render = () => {
      const sel = h('select', { title: 'League', onchange: () => { config.sports.league = sel.value; save(); load(); } },
        ...Object.entries(LEAGUES).map(([k, [name]]) => h('option', { value: k }, name)));
      sel.value = config.sports.league;
      const refresh = h('button', { title: 'Refresh scores', onclick: load }, '\u21BB');
      let body;
      if (state.loading) body = h('div', { class: 'muted' }, 'Loading\u2026');
      else if (state.error) body = h('div', { class: 'muted' }, state.error);
      else if (!state.games.length) body = h('div', { class: 'muted' }, 'No games today');
      else body = h('ul', { class: 'game-list' }, ...state.games.map(gameEl));
      root.replaceChildren(h('h2', {}, titleLink('Scores', 'https://www.espn.com'), h('span', { class: 'btns' }, sel, refresh)), body);
    };
    load();
  }
  // ---------- clock ----------
  function clockWidget(root) {
    const time = h('div', { class: 'clock-time' });
    const date = h('div', { class: 'muted clock-date' });
    const toggle = h('button', { title: 'Switch between 12-hour and 24-hour time', onclick: () => { config.clock24 = !config.clock24; save(); tick(); } });
    const tick = () => {
      const now = new Date();
      time.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !config.clock24 });
      date.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      toggle.textContent = config.clock24 ? '24h' : '12h';
    };
    root.replaceChildren(h('h2', {}, titleLink('Clock', 'https://time.is'), toggle), time, date);
    tick();
    setInterval(tick, 1000);
  }

  // ---------- calendar ----------
  function calendar(root) {
    const today = new Date();
    let year = today.getFullYear(), month = today.getMonth();
    const shift = n => { const d = new Date(year, month + n, 1); year = d.getFullYear(); month = d.getMonth(); render(); };
    const nav = (label, title, fn) => h('button', { title, onclick: fn }, label);

    const render = () => {
      const first = new Date(year, month, 1);
      const days = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first.getDay(); i++) cells.push(h('span', {}));
      for (let d = 1; d <= days; d++) {
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        cells.push(h('span', { class: isToday ? 'cal-day cal-today' : 'cal-day' }, String(d)));
      }
      const heads = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(l => h('span', { class: 'cal-head' }, l));
      root.replaceChildren(
        h('h2', {}, first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          h('span', { class: 'btns' },
            nav('\u00AB', 'Previous year', () => shift(-12)), nav('\u2039', 'Previous month', () => shift(-1)),
            nav('Today', 'Back to this month', () => { year = today.getFullYear(); month = today.getMonth(); render(); }),
            nav('\u203A', 'Next month', () => shift(1)), nav('\u00BB', 'Next year', () => shift(12)))),
        h('div', { class: 'cal-grid' }, ...heads, ...cells));
    };
    render();
  }

  // ---------- Jotform website widget ----------
  function jotform(root) {
    const target = h('div', { id: 'JFWebsiteWidget-01a1039293207000825c140f3a7fe7b6a104' });
    const script = document.createElement('script');
    script.src = 'https://www.jotform.com/website-widgets/embed/01a1039293207000825c140f3a7fe7b6a104';
    script.defer = true;
    root.replaceChildren(h('h2', {}, 'Jotform'), target);
    root.append(script);
  }

  // ---------- widget columns with drag between and within columns ----------
  quicklaunch(document.getElementById('quicklaunch'));

  const WIDGETS = { bookmarks, weather, notes, calendar, clock: clockWidget, news, stocks, sports, jotform };
  const container = document.getElementById('widgets');
  const cols = Array.from({ length: COLUMNS }, () => { const c = document.createElement('div'); c.className = 'col'; container.append(c); return c; });
  const placed = new Set();
  config.columns.forEach((ids, i) => {
    for (const id of ids) {
      if (!(id in WIDGETS) || placed.has(id)) continue;
      placed.add(id);
      addWidget(id, cols[i]);
    }
  });
  // Widgets not in the saved layout go to the emptiest column
  for (const id of Object.keys(WIDGETS).filter(id => !placed.has(id))) {
    addWidget(id, cols.reduce((a, b) => (b.children.length < a.children.length ? b : a)));
  }

  function addWidget(id, col) {
    const el = document.createElement('section');
    el.className = 'widget';
    el.dataset.id = id;
    col.append(el);
    WIDGETS[id](el);
    if (CAPPED.has(id)) capHeight(el);
  }

  // Tall widgets stop at the height of the Weather widget (CSS --cap) until the user expands them
  function capHeight(el) {
    let expanded = false;
    const more = h('button', { class: 'cap-toggle', onclick: () => { expanded = !expanded; update(); } });
    const mo = new MutationObserver(() => update());
    const watch = () => mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    function update() {
      mo.disconnect();
      el.classList.remove('capped', 'expanded');
      const cap = parseFloat(getComputedStyle(el).getPropertyValue('--cap')) || 331;
      const tall = el.scrollHeight > cap + 1;
      more.hidden = true; // measure the content without the button
      if (more.parentElement !== el) el.append(more);
      el.classList.toggle('capped', tall && !expanded);
      el.classList.toggle('expanded', tall && expanded);
      more.hidden = !tall;
      more.textContent = expanded ? '\u25B4 Show less' : '\u25BE Show more';
      more.title = expanded ? 'Collapse this section' : 'Expand this section to full height';
      watch();
    }
    update();
  }


  // Draggable is enabled only while a title is pressed, so text selection in inputs and notes still works.
  let dragging = null;
  container.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.widget > h2');
    if (handle) handle.parentElement.draggable = true;
  });
  container.addEventListener('dragstart', e => {
    dragging = e.target.closest('.widget');
    if (!dragging) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.dataset.id);
    requestAnimationFrame(() => dragging.classList.add('dragging'));
  });
  container.addEventListener('dragover', e => {
    if (!dragging) return;
    e.preventDefault();
    // The column under the pointer (by x position, so empty columns work), then the first widget whose middle is below the pointer
    const col = cols.find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; })
      || e.target.closest('.col');
    if (!col) return;
    const next = [...col.children].filter(w => w !== dragging).find(w => {
      const r = w.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (next) { if (dragging.nextElementSibling !== next) col.insertBefore(dragging, next); }
    else if (col.lastElementChild !== dragging) col.append(dragging);
  });
  container.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('dragging');
    dragging.draggable = false;
    dragging = null;
    config.columns = cols.map(c => [...c.children].map(el => el.dataset.id));
    save();
  });
  container.addEventListener('pointerup', () => {
    if (!dragging) container.querySelectorAll('.widget[draggable="true"]').forEach(el => { el.draggable = false; });
  });
})();

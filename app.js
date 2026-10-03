(function () {
  'use strict';

  const STORAGE_KEY = 'bcp-config';
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
    order: ['bookmarks', 'weather', 'calendar', 'notes'],
  };

  // ---------- helpers ----------
  const isHttp = u => /^https?:\/\//i.test(u);
  const safeUrl = u => (isHttp(u) ? u : '#');

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
    if (Array.isArray(raw.order)) c.order = raw.order.filter(str);
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
    root.replaceChildren(h('h2', {}, 'Weather', unit), body, h('div', { class: 'row' }, place, change), status);

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

  // ---------- widget grid with drag-to-reorder ----------
  quicklaunch(document.getElementById('quicklaunch'));

  const WIDGETS = { bookmarks, weather, notes, calendar };
  const container = document.getElementById('widgets');
  // Saved order first, then any widgets missing from it
  const order = [...config.order.filter(id => id in WIDGETS), ...Object.keys(WIDGETS).filter(id => !config.order.includes(id))];
  for (const id of order) {
    const el = document.createElement('section');
    el.className = 'widget';
    el.dataset.id = id;
    container.append(el);
    WIDGETS[id](el);
    // Rows are 1px tall, so each widget spans its own height (plus a 16px gap) and stacks directly under the one above it
    const fit = () => { el.style.gridRowEnd = `span ${Math.ceil(el.offsetHeight) + 16}`; };
    fit();
    new ResizeObserver(fit).observe(el);
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
    const target = e.target.closest('.widget');
    if (!target || target === dragging) return;
    const r = target.getBoundingClientRect();
    const d = dragging.getBoundingClientRect();
    const sameRow = d.top < r.bottom && d.bottom > r.top;
    const before = sameRow ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    container.insertBefore(dragging, before ? target : target.nextSibling);
  });
  container.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('dragging');
    dragging.draggable = false;
    dragging = null;
    config.order = [...container.children].map(el => el.dataset.id);
    save();
  });
  container.addEventListener('pointerup', () => {
    if (!dragging) container.querySelectorAll('.widget[draggable="true"]').forEach(el => { el.draggable = false; });
  });
})();

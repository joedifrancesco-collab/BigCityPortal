(function () {
  'use strict';

  const STORAGE_KEY = 'bcp-config';
  const DEFAULTS = {
    theme: 'light',
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
    order: ['bookmarks', 'weather', 'notes'],
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
      ? list.filter(b => b && str(b.title) && str(b.url) && isHttp(b.url))
          .map(b => ({ title: b.title, url: b.url, ...(str(b.folder) && b.folder ? { folder: b.folder } : {}) }))
      : null;
    c.bookmarks = links(raw.bookmarks) ?? c.bookmarks;
    c.quicklaunch = links(raw.quicklaunch) ?? c.quicklaunch;
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

  // ---------- bookmarks (with Chrome/Edge HTML import) ----------
  // Parses a Chrome/Edge "Export bookmarks" HTML file (Netscape format)
  function parseBookmarkFile(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const found = [];
    for (const a of doc.querySelectorAll('a[href]')) {
      const url = a.getAttribute('href').trim();
      if (!isHttp(url)) continue;
      const path = [];
      for (let dl = a.closest('dl'); dl; dl = dl.parentElement?.closest('dl')) {
        const name = dl.previousElementSibling?.tagName === 'H3' ? dl.previousElementSibling.textContent.trim() : '';
        if (name) path.unshift(name);
      }
      found.push({ title: a.textContent.trim() || url, url, folder: path.join(' / ') });
    }
    return found;
  }

  function bookmarks(root) {
    let message = '';

    const item = (b, i) => h('li', {},
      h('a', { href: safeUrl(b.url), target: '_blank', rel: 'noopener' }, b.title),
      h('button', { class: 'x', title: 'Remove', onclick: () => { config.bookmarks.splice(i, 1); save(); render(); } }, '✕'));

    const importFile = async file => {
      try {
        const parsed = parseBookmarkFile(await file.text());
        const known = new Set(config.bookmarks.map(b => b.url));
        const fresh = parsed.filter(b => !known.has(b.url) && known.add(b.url));
        config.bookmarks.push(...fresh);
        save();
        message = `Imported ${fresh.length} bookmark${fresh.length === 1 ? '' : 's'}` +
          (parsed.length - fresh.length ? `, skipped ${parsed.length - fresh.length} duplicates` : '');
      } catch { message = 'Could not read that file'; }
      render();
    };

    const render = () => {
      const folders = new Map();
      const loose = [];
      config.bookmarks.forEach((b, i) => {
        if (!b.folder) loose.push(item(b, i));
        else (folders.get(b.folder) ?? folders.set(b.folder, []).get(b.folder)).push(item(b, i));
      });
      const groups = [...folders].map(([name, items]) =>
        h('details', {}, h('summary', {}, `${name} (${items.length})`), h('ul', {}, ...items)));

      const title = h('input', { placeholder: 'Title' });
      const url = h('input', { placeholder: 'https://…' });
      const add = h('button', { onclick: () => {
        if (!title.value.trim() || !isHttp(url.value.trim())) return;
        config.bookmarks.push({ title: title.value.trim(), url: url.value.trim() });
        message = '';
        save(); render();
      } }, 'Add');

      const picker = h('input', { type: 'file', accept: '.html,text/html', hidden: '' });
      picker.onchange = () => picker.files[0] && importFile(picker.files[0]);
      const importBtn = h('button', { title: 'In Chrome/Edge: Bookmarks manager → ⋮ → Export bookmarks', onclick: () => picker.click() }, 'Import');

      root.replaceChildren(
        h('h2', {}, 'Bookmarks', importBtn), h('ul', {}, ...loose), ...groups,
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

  // ---------- widget grid with drag-to-reorder ----------
  quicklaunch(document.getElementById('quicklaunch'));

  const WIDGETS = { bookmarks, weather, notes };
  const container = document.getElementById('widgets');
  // Saved order first, then any widgets missing from it
  const order = [...config.order.filter(id => id in WIDGETS), ...Object.keys(WIDGETS).filter(id => !config.order.includes(id))];
  for (const id of order) {
    const el = document.createElement('section');
    el.className = 'widget';
    el.dataset.id = id;
    container.append(el);
    WIDGETS[id](el);
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

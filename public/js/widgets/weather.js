import { h } from '../dom.js';

const CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

export async function weather(root, config, save) {
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
      save(); place.value = ''; status.textContent = ''; load();
    } catch { status.textContent = 'Lookup failed'; }
  } }, 'Set');
  const unit = h('button', { onclick: () => { w.unit = w.unit === 'fahrenheit' ? 'celsius' : 'fahrenheit'; save(); load(); } }, '°F/°C');
  root.replaceChildren(h('h2', {}, 'Weather', unit), body, h('div', { class: 'row' }, place, change), status);

  async function load() {
    try {
      const f = w.unit === 'fahrenheit';
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code` +
        `&timezone=auto&temperature_unit=${w.unit}&wind_speed_unit=${f ? 'mph' : 'kmh'}`;
      const d = await (await fetch(u)).json();
      const sym = f ? '°F' : '°C';
      const days = d.daily.time.slice(0, 5).map((t, i) => h('li', {},
        h('span', {}, new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' })),
        h('span', { class: 'muted' }, CODES[d.daily.weather_code[i]] ?? ''),
        h('span', {}, `${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°`)));
      body.className = '';
      body.replaceChildren(
        h('div', {}, h('span', { class: 'big' }, `${Math.round(d.current.temperature_2m)}${sym}`), ` ${w.name}`),
        h('div', { class: 'muted' }, `${CODES[d.current.weather_code] ?? ''} · Wind ${Math.round(d.current.wind_speed_10m)} ${f ? 'mph' : 'km/h'}`),
        h('ul', {}, ...days));
    } catch { body.textContent = 'Weather unavailable'; }
  }
  load();
}

import { loadConfig, getConfig, saveConfig } from './config.js';
import { bookmarks } from './widgets/bookmarks.js';
import { weather } from './widgets/weather.js';
import { rss } from './widgets/rss.js';
import { notes } from './widgets/notes.js';

const config = await loadConfig();

function applyTheme() {
  document.documentElement.dataset.theme = config.theme;
}
applyTheme();
document.getElementById('theme-toggle').onclick = () => {
  config.theme = config.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveConfig();
};

const clock = document.getElementById('clock');
const tick = () => {
  clock.textContent = new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
tick();
setInterval(tick, 15000);

const engine = document.getElementById('engine');
for (const name of Object.keys(config.engines)) engine.add(new Option(name, name, false, name === config.engine));
engine.onchange = () => { config.engine = engine.value; saveConfig(); };
document.getElementById('search').onsubmit = e => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (q) location.href = config.engines[engine.value] + encodeURIComponent(q);
};

const container = document.getElementById('widgets');
for (const widget of [bookmarks, weather, rss, notes]) {
  const el = document.createElement('section');
  el.className = 'widget';
  container.append(el);
  widget(el, getConfig(), saveConfig);
}

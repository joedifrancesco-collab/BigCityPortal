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
  if (q) window.open(config.engines[engine.value] + encodeURIComponent(q), '_blank', 'noopener');
};

const WIDGETS = { bookmarks, weather, rss, notes };
const container = document.getElementById('widgets');

// Saved order first, then any widgets missing from it
const order = [...config.order.filter(id => id in WIDGETS), ...Object.keys(WIDGETS).filter(id => !config.order.includes(id))];
for (const id of order) {
  const el = document.createElement('section');
  el.className = 'widget';
  el.dataset.id = id;
  container.append(el);
  WIDGETS[id](el, getConfig(), saveConfig);
}

// Drag a widget by its title to reorder. Draggable is enabled only while the title is pressed,
// so text selection in inputs and notes still works.
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
  saveConfig();
});
container.addEventListener('pointerup', () => container.querySelectorAll('.widget[draggable="true"]').forEach(el => { if (!dragging) el.draggable = false; }));

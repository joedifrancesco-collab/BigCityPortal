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
  weather: { name: 'New York', lat: 40.71, lon: -74.01, unit: 'fahrenheit' },
  feeds: [{ title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' }],
  notes: '',
};

let config = structuredClone(DEFAULTS);
let saveTimer;

export const getConfig = () => config;

export async function loadConfig() {
  try {
    const saved = await (await fetch('/api/config')).json();
    if (saved) config = { ...structuredClone(DEFAULTS), ...saved };
  } catch { /* server unavailable: use defaults */ }
  return config;
}

export function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config, null, 2),
    }).catch(() => {});
  }, 300);
}

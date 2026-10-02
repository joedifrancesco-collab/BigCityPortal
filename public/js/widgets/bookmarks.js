import { h, safeUrl } from '../dom.js';

// Parses a Chrome/Edge "Export bookmarks" HTML file (Netscape format)
export function parseBookmarkFile(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const url = a.getAttribute('href').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const path = [];
    for (let dl = a.closest('dl'); dl; dl = dl.parentElement?.closest('dl')) {
      const name = dl.previousElementSibling?.tagName === 'H3' ? dl.previousElementSibling.textContent.trim() : '';
      if (name) path.unshift(name);
    }
    found.push({ title: a.textContent.trim() || url, url, folder: path.join(' / ') });
  }
  return found;
}

export function bookmarks(root, config, save) {
  let message = '';

  const item = (b, i) => h('li', {},
    h('a', { href: safeUrl(b.url) }, b.title),
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
    const list = h('ul', {}, ...loose);
    const groups = [...folders].map(([name, items]) =>
      h('details', {}, h('summary', {}, `${name} (${items.length})`), h('ul', {}, ...items)));

    const title = h('input', { placeholder: 'Title' });
    const url = h('input', { placeholder: 'https://…' });
    const add = h('button', { onclick: () => {
      if (!title.value.trim() || !/^https?:\/\//i.test(url.value.trim())) return;
      config.bookmarks.push({ title: title.value.trim(), url: url.value.trim() });
      message = '';
      save(); render();
    } }, 'Add');

    const picker = h('input', { type: 'file', accept: '.html,text/html', hidden: '' });
    picker.onchange = () => picker.files[0] && importFile(picker.files[0]);
    const importBtn = h('button', { title: 'In Chrome/Edge: Bookmarks manager → ⋮ → Export bookmarks', onclick: () => picker.click() }, 'Import');

    root.replaceChildren(
      h('h2', {}, 'Bookmarks', importBtn), list, ...groups,
      h('div', { class: 'row' }, title, url, add), picker,
      h('div', { class: 'muted' }, message));
  };
  render();
}

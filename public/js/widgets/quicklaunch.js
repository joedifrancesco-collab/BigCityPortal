import { h, safeUrl } from '../dom.js';

const hostOf = u => { try { return new URL(u).hostname; } catch { return ''; } };

function webIcon(item) {
  const letter = h('span', { class: 'ql-icon' }, (item.title[0] || '?').toUpperCase());
  const img = h('img', { class: 'ql-icon', alt: '', src: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(item.url))}` });
  img.onerror = () => img.replaceWith(letter);
  return img;
}

export async function quicklaunch(root, config, save) {
  let apps = [];
  try { apps = await (await fetch('/api/apps')).json(); } catch { /* server unavailable */ }
  const appById = Object.fromEntries(apps.map(a => [a.id, a]));
  let editing = false;

  const launch = id => fetch('/api/launch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
  }).catch(() => {});

  const tile = (item, i) => {
    let el;
    if (item.type === 'app') {
      const app = appById[item.id];
      if (!app) return null;
      el = h('button', { class: 'ql-tile', title: `Launch ${app.label}`, onclick: () => launch(item.id) },
        h('span', { class: 'ql-icon' }, app.icon), h('span', {}, app.label));
    } else {
      el = h('a', { class: 'ql-tile', href: safeUrl(item.url), target: '_blank', rel: 'noopener' }, webIcon(item), h('span', {}, item.title));
    }
    if (!editing) return el;
    const remove = h('button', { class: 'ql-remove', title: 'Remove', onclick: e => {
      e.preventDefault(); e.stopPropagation();
      config.quicklaunch.splice(i, 1); save(); render();
    } }, '✕');
    el.style.pointerEvents = 'none';
    return h('div', { class: 'ql-wrap' }, el, remove);
  };

  const editor = () => {
    const kind = h('select', {}, h('option', { value: 'web' }, 'Web app'), ...(apps.length ? [h('option', { value: 'app' }, 'Windows app')] : []));
    const title = h('input', { placeholder: 'Title' });
    const url = h('input', { placeholder: 'https://…' });
    const app = h('select', {}, ...apps.map(a => h('option', { value: a.id }, `${a.icon} ${a.label}`)));
    app.hidden = true;
    kind.onchange = () => {
      const isApp = kind.value === 'app';
      title.hidden = url.hidden = isApp; app.hidden = !isApp;
    };
    const add = h('button', { onclick: () => {
      if (kind.value === 'app') config.quicklaunch.push({ type: 'app', id: app.value });
      else {
        if (!title.value.trim() || !/^https?:\/\//i.test(url.value.trim())) return;
        config.quicklaunch.push({ type: 'web', title: title.value.trim(), url: url.value.trim() });
      }
      save(); render();
    } }, 'Add');
    return h('div', { class: 'row ql-edit' }, kind, title, url, app, add);
  };

  const render = () => {
    const edit = h('button', { class: 'ql-edit-btn', onclick: () => { editing = !editing; render(); } }, editing ? 'Done' : 'Edit');
    root.replaceChildren(
      h('div', { class: 'ql-tiles' }, ...config.quicklaunch.map(tile).filter(Boolean), edit),
      ...(editing ? [editor()] : []));
  };
  render();
}

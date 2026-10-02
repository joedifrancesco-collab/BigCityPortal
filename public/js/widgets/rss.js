import { h, safeUrl } from '../dom.js';

async function loadFeed(url) {
  const xml = new DOMParser().parseFromString(await (await fetch(`/api/rss?url=${encodeURIComponent(url)}`)).text(), 'text/xml');
  const text = (n, sel) => n.querySelector(sel)?.textContent?.trim() ?? '';
  return [...xml.querySelectorAll('item, entry')].slice(0, 8).map(n => ({
    title: text(n, 'title'),
    link: text(n, 'link') || n.querySelector('link')?.getAttribute('href') || '',
  }));
}

export function rss(root, config, save) {
  const render = () => {
    const parts = [h('h2', {}, 'RSS Feeds')];
    config.feeds.forEach((f, i) => {
      const list = h('ul', {});
      let loaded = false;
      const load = () => {
        if (loaded) return;
        loaded = true;
        list.replaceChildren(h('li', { class: 'muted' }, 'Loading…'));
        loadFeed(f.url).then(items => list.replaceChildren(...items.map(it => h('li', {}, h('a', { href: safeUrl(it.link), target: '_blank', rel: 'noopener' }, it.title)))))
          .catch(() => { loaded = false; list.replaceChildren(h('li', { class: 'muted' }, 'Could not load feed')); });
      };
      const remove = h('button', { class: 'x', title: 'Remove feed', onclick: e => {
        e.preventDefault(); e.stopPropagation();
        config.feeds.splice(i, 1); save(); render();
      } }, '✕');
      const d = h('details', { class: 'feed' }, h('summary', {}, h('span', {}, f.title), remove), list);
      d.open = !f.collapsed;
      d.addEventListener('toggle', () => {
        if (d.open) load();
        if (!!f.collapsed === d.open) { f.collapsed = !d.open; save(); }
      });
      if (d.open) load();
      parts.push(d);
    });
    const title = h('input', { placeholder: 'Title' });
    const url = h('input', { placeholder: 'Feed URL' });
    parts.push(h('div', { class: 'row' }, title, url, h('button', { onclick: () => {
      if (!title.value.trim() || !/^https?:\/\//i.test(url.value.trim())) return;
      config.feeds.push({ title: title.value.trim(), url: url.value.trim() });
      save(); render();
    } }, 'Add')));
    root.replaceChildren(...parts);
  };
  render();
}

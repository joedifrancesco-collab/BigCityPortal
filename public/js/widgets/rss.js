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
      const list = h('ul', {}, h('li', { class: 'muted' }, 'Loading…'));
      parts.push(
        h('h3', { class: 'muted' }, f.title, h('button', { class: 'x', title: 'Remove feed', onclick: () => { config.feeds.splice(i, 1); save(); render(); } }, '✕')),
        list);
      loadFeed(f.url).then(items => list.replaceChildren(...items.map(it => h('li', {}, h('a', { href: safeUrl(it.link), target: '_blank', rel: 'noopener' }, it.title)))))
        .catch(() => list.replaceChildren(h('li', { class: 'muted' }, 'Could not load feed')));
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

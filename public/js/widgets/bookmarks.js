import { h, safeUrl } from '../dom.js';

export function bookmarks(root, config, save) {
  const render = () => {
    const list = h('ul');
    config.bookmarks.forEach((b, i) => list.append(h('li', {},
      h('a', { href: safeUrl(b.url) }, b.title),
      h('button', { class: 'x', title: 'Remove', onclick: () => { config.bookmarks.splice(i, 1); save(); render(); } }, '✕'))));
    const title = h('input', { placeholder: 'Title' });
    const url = h('input', { placeholder: 'https://…' });
    const add = h('button', { onclick: () => {
      if (!title.value.trim() || !/^https?:\/\//i.test(url.value.trim())) return;
      config.bookmarks.push({ title: title.value.trim(), url: url.value.trim() });
      save(); render();
    } }, 'Add');
    root.replaceChildren(h('h2', {}, 'Bookmarks'), list, h('div', { class: 'row' }, title, url, add));
  };
  render();
}

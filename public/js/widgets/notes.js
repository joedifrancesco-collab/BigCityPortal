import { h } from '../dom.js';

export function notes(root, config, save) {
  const area = h('textarea', { placeholder: 'Quick notes…' });
  area.value = config.notes;
  area.oninput = () => { config.notes = area.value; save(); };
  root.replaceChildren(h('h2', {}, 'Notes'), area);
}

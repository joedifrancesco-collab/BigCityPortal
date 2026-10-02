export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el[k] = v; else if (k === 'class') el.className = v; else el.setAttribute(k, v);
  }
  el.append(...children.filter(c => c != null));
  return el;
}

// Only allow http(s) links from untrusted data
export const safeUrl = u => (/^https?:\/\//i.test(u) ? u : '#');

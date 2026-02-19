export const HAS_INLINE_RE = /\[[^\]]*\]\([^)]*\)|https?:\/\/|\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*|\*[^*\s]\*|__[^_]+__/;

export function renderInlineContent(el: HTMLElement, text: string): void {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*|\*[^*\s]\*|__[^_]+__|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+)/g);
  el.innerHTML = '';
  parts.forEach(part => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    const italicMatch = part.match(/^\*([^*\s](?:[^*]*[^*\s])?)\*$/);
    const underlineMatch = part.match(/^__([^_]+)__$/);
    const mdMatch = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    const urlMatch = part.match(/^https?:\/\/\S+$/);
    if (boldMatch) {
      const b = document.createElement('b');
      b.textContent = boldMatch[1];
      el.appendChild(b);
    } else if (italicMatch) {
      const em = document.createElement('em');
      em.textContent = italicMatch[1];
      el.appendChild(em);
    } else if (underlineMatch) {
      const u = document.createElement('u');
      u.textContent = underlineMatch[1];
      el.appendChild(u);
    } else if (mdMatch) {
      const a = document.createElement('a');
      a.className = 'md-link';
      a.textContent = mdMatch[1] || mdMatch[2];
      a.href = mdMatch[2];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', e => e.stopPropagation());
      el.appendChild(a);
    } else if (urlMatch) {
      const a = document.createElement('a');
      a.className = 'md-link';
      a.textContent = part;
      a.href = part;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', e => e.stopPropagation());
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
}

export function showRawText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

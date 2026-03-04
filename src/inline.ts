export const TAG_RE = /#[a-zA-Z0-9][a-zA-Z0-9_-]*/;

export const HAS_INLINE_RE =
  /\[[^\]]*\]\([^)]*\)|https?:\/\/|\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*|\*[^*\s]\*|__[^_]+__|#[a-zA-Z0-9][a-zA-Z0-9_-]*/;

export function renderInlineContent(el: HTMLElement, text: string): void {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*|\*[^*\s]\*|__[^_]+__|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|#[a-zA-Z0-9][a-zA-Z0-9_-]*)/g,
  );
  el.innerHTML = "";
  parts.forEach((part) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    const italicMatch = part.match(/^\*([^*\s](?:[^*]*[^*\s])?)\*$/);
    const underlineMatch = part.match(/^__([^_]+)__$/);
    const mdMatch = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    const urlMatch = part.match(/^https?:\/\/\S+$/);
    if (boldMatch) {
      const b = document.createElement("b");
      b.textContent = boldMatch[1];
      el.appendChild(b);
    } else if (italicMatch) {
      const em = document.createElement("em");
      em.textContent = italicMatch[1];
      el.appendChild(em);
    } else if (underlineMatch) {
      const u = document.createElement("u");
      u.textContent = underlineMatch[1];
      el.appendChild(u);
    } else if (mdMatch) {
      const a = document.createElement("a");
      a.className = "md-link";
      a.textContent = mdMatch[1] || mdMatch[2];
      a.href = mdMatch[2];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.tabIndex = -1;
      a.addEventListener("click", (e) => e.stopPropagation());
      el.appendChild(a);
    } else if (urlMatch) {
      const a = document.createElement("a");
      a.className = "md-link";
      a.textContent = part;
      a.href = part;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.tabIndex = -1;
      a.addEventListener("click", (e) => e.stopPropagation());
      el.appendChild(a);
    } else if (TAG_RE.test(part)) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = part;
      span.tabIndex = -1;
      // mousedown の default を止めて textEl へのフォーカス移動（→ showRawText）を防ぐ
      span.addEventListener("mousedown", (e) => e.preventDefault());
      span.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent("bloomline:tag-click", { detail: part }));
      });
      el.appendChild(span);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
}

export function showRawText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

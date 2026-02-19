export function getCursorPos(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function setCursorPos(el: HTMLElement, pos: number): void {
  const range = document.createRange();
  const sel = window.getSelection()!;
  let charCount = 0;
  let found = false;

  function walk(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent!.length;
      if (charCount + len >= pos) {
        range.setStart(node, pos - charCount);
        range.collapse(true);
        found = true;
      } else {
        charCount += len;
      }
    } else {
      for (const child of node.childNodes) walk(child);
    }
  }

  walk(el);
  if (!found) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function isAtStart(el: HTMLElement): boolean {
  return getCursorPos(el) === 0;
}

export function isAtEnd(el: HTMLElement): boolean {
  return getCursorPos(el) === el.textContent!.length;
}

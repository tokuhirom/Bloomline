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

// ===== 複数行（折り返し）対応 =====

/**
 * カーソルの top と要素の最初/最後の行の top を比較する純粋関数。
 * isOnFirstLine / isOnLastLine の判定ロジックを分離してテスト可能にしたもの。
 */
export function isTopLine(cursorTop: number, firstLineTop: number, threshold = 5): boolean {
  return Math.abs(cursorTop - firstLineTop) < threshold;
}

export function isBottomLine(cursorTop: number, lastLineTop: number, threshold = 5): boolean {
  return Math.abs(cursorTop - lastLineTop) < threshold;
}

/** カーソルが要素の最初の視覚行にあるか判定する */
export function isOnFirstLine(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return true;
  const cursorRange = sel.getRangeAt(0).cloneRange();
  cursorRange.collapse(true);
  const startRange = document.createRange();
  startRange.selectNodeContents(el);
  startRange.collapse(true);
  const cursorRects = cursorRange.getClientRects();
  const startRects = startRange.getClientRects();
  if (!cursorRects.length || !startRects.length) return true;
  return isTopLine(cursorRects[0].top, startRects[0].top);
}

/** カーソルが要素の最後の視覚行にあるか判定する */
export function isOnLastLine(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return true;
  const cursorRange = sel.getRangeAt(0).cloneRange();
  cursorRange.collapse(true);
  const endRange = document.createRange();
  endRange.selectNodeContents(el);
  endRange.collapse(false);
  const cursorRects = cursorRange.getClientRects();
  const endRects = endRange.getClientRects();
  if (!cursorRects.length || !endRects.length) return true;
  return isBottomLine(cursorRects[0].top, endRects[0].top);
}

/** カーソルのクライアント X 座標を返す */
export function getCursorClientX(): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  return rects.length ? rects[0].left : 0;
}

/**
 * X 座標に最も近い位置にカーソルを置く。
 * atTop=true: 要素の上端付近、atTop=false: 下端付近。
 */
export function setCursorByClientX(el: HTMLElement, x: number, atTop: boolean): void {
  if (el.contentEditable === "false") el.contentEditable = "true";
  el.focus();
  const elRect = el.getBoundingClientRect();
  const y = atTop ? elRect.top + 2 : Math.max(elRect.top + 2, elRect.bottom - 2);
  // x を要素の水平範囲にクランプして要素外の位置が返るのを防ぐ
  const clampedX = Math.max(elRect.left + 1, Math.min(elRect.right - 1, x));
  let range: Range | null = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clampedX, y);
  } else {
    type DocWithPos = {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    const pos = (document as unknown as DocWithPos).caretPositionFromPoint?.(clampedX, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  // caretRangeFromPoint が el の外の要素を返すことがあるので el 内であることを確認する
  if (range && el.contains(range.startContainer)) {
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    // x が要素の左寄りなら先頭、右寄りなら末尾にフォールバック
    const fallbackPos = x < elRect.left + elRect.width / 2 ? 0 : el.textContent!.length;
    setCursorPos(el, fallbackPos);
  }
}

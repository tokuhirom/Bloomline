import { store } from './store';
import { createNode, uuid } from './model';
import { findNode, flatVisibleNodes, getPathToNode } from './nodeHelpers';
import { getCursorPos, setCursorPos } from './cursor';
import { getSelectionRange, clearSelection, updateSelectionDisplay } from './selection';
import { recordHistory } from './history';
import { applySearch } from './search';
import { showToast } from './toast';
import type { BloomlineNode } from './types';

// ===== Cursor movement (DOM only, no render needed) =====

export function emacsBackward(textEl: HTMLElement): void {
  const pos = getCursorPos(textEl);
  if (pos > 0) setCursorPos(textEl, pos - 1);
}

export function emacsForward(textEl: HTMLElement): void {
  const pos = getCursorPos(textEl);
  if (pos < textEl.textContent!.length) setCursorPos(textEl, pos + 1);
}

export function emacsLineStart(textEl: HTMLElement): void {
  setCursorPos(textEl, 0);
}

export function emacsLineEnd(textEl: HTMLElement): void {
  setCursorPos(textEl, textEl.textContent!.length);
}

// ===== Emacs editing =====

export function emacsDeleteForward(node: BloomlineNode, textEl: HTMLElement, render: () => void): void {
  const pos = getCursorPos(textEl);
  const text = node.text;
  if (pos < text.length) {
    recordHistory();
    node.text = text.slice(0, pos) + text.slice(pos + 1);
    store.lastFocusId = node.id;
    store.lastFocusOffset = pos;
    render();
  }
}

export function emacsDeleteBackward(node: BloomlineNode, textEl: HTMLElement, render: () => void): void {
  const pos = getCursorPos(textEl);
  const text = node.text;
  if (pos > 0) {
    recordHistory();
    node.text = text.slice(0, pos - 1) + text.slice(pos);
    store.lastFocusId = node.id;
    store.lastFocusOffset = pos - 1;
    render();
  }
}

export function emacsDeleteToEol(node: BloomlineNode, textEl: HTMLElement, render: () => void): void {
  const pos = getCursorPos(textEl);
  if (pos < node.text.length) {
    recordHistory();
    node.text = node.text.slice(0, pos);
    store.lastFocusId = node.id;
    store.lastFocusOffset = pos;
    render();
  }
}

// ===== Enter variants =====

export function toggleChecked(node: BloomlineNode, render: () => void): void {
  if (node.checked !== undefined) {
    recordHistory();
    node.checked = !node.checked;
    store.lastFocusId = node.id;
    render();
  }
}

export function openNote(noteEl: HTMLElement): void {
  noteEl.classList.remove('hidden');
  noteEl.focus();
  const r = document.createRange();
  r.selectNodeContents(noteEl);
  r.collapse(false);
  const s = window.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
}

export function splitNode(
  node: BloomlineNode,
  textEl: HTMLElement,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  recordHistory();
  const pos = getCursorPos(textEl);
  const text = node.text;
  const before = text.slice(0, pos);
  const after = text.slice(pos);

  node.text = before;
  textEl.textContent = before;

  const newNode = createNode(after, node.checked !== undefined ? false : undefined);

  const res = findNode(node.id, currentRoot);
  if (!res || !res.parent) return;
  const { parent, index } = res;

  if (node.children.length > 0 && !node.collapsed) {
    node.children.unshift(newNode);
  } else {
    parent.children.splice(index + 1, 0, newNode);
  }

  store.lastFocusId = newNode.id;
  store.lastFocusOffset = 0;
  render();
}

// ===== Indent / Outdent =====

export function indentNode(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
  skipRender = false,
): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (index === 0) return;
  if (!skipRender) recordHistory();

  const prevSibling = parent!.children[index - 1];
  parent!.children.splice(index, 1);
  if (prevSibling.collapsed) prevSibling.collapsed = false;
  prevSibling.children.push(node);

  store.lastFocusId = node.id;
  if (!skipRender) render();
}

export function outdentNode(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
  skipRender = false,
): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (!skipRender) recordHistory();

  const parentRes = parent === currentRoot ? null : findNode(parent!.id, currentRoot);
  if (!parentRes && parent !== currentRoot) return;

  const grandParent = parentRes ? parentRes.parent : null;
  const parentIndex = parentRes ? parentRes.index : null;

  if (!grandParent) return;

  parent!.children.splice(index, 1);
  const afterSiblings = parent!.children.splice(index);
  node.children.push(...afterSiblings);
  grandParent.children.splice(parentIndex! + 1, 0, node);

  store.lastFocusId = node.id;
  if (!skipRender) render();
}

// ===== Remove / Merge =====

export function removeNode(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;

  if (parent === currentRoot && parent!.children.length === 1) return;
  recordHistory();

  const flat = flatVisibleNodes(currentRoot);
  const nodeIndex = flat.findIndex(n => n.id === node.id);
  const prevNode = flat[nodeIndex - 1] || flat[nodeIndex + 1];

  parent!.children.splice(index, 1);
  if (prevNode) {
    store.lastFocusId = prevNode.id;
    store.lastFocusOffset = prevNode.text.length;
  }
  render();
}

export function mergeWithPrev(
  node: BloomlineNode,
  _textEl: HTMLElement,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  recordHistory();
  const flat = flatVisibleNodes(currentRoot);
  const idx = flat.findIndex(n => n.id === node.id);
  if (idx <= 0) return;

  const prevNode = flat[idx - 1];
  const prevLen = prevNode.text.length;
  const mergedText = prevNode.text + node.text;
  prevNode.text = mergedText;

  node.children.forEach(c => prevNode.children.push(c));

  const res = findNode(node.id, currentRoot);
  if (res) {
    res.parent!.children.splice(res.index, 1);
  }

  store.lastFocusId = prevNode.id;
  store.lastFocusOffset = prevLen;
  render();
}

// ===== Move nodes =====

export function moveNodeUp(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (index === 0) return;
  recordHistory();
  parent!.children.splice(index, 1);
  parent!.children.splice(index - 1, 0, node);
  store.lastFocusId = node.id;
  render();
}

export function moveNodeDown(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (index >= parent!.children.length - 1) return;
  recordHistory();
  parent!.children.splice(index, 1);
  parent!.children.splice(index + 1, 0, node);
  store.lastFocusId = node.id;
  render();
}

// ===== Selection expansion =====

export function expandSelectionUp(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const flat = flatVisibleNodes(currentRoot);
  if (!store.selAnchorId) store.selAnchorId = node.id;
  const focusId = store.selFocusId || node.id;
  const idx = flat.findIndex(n => n.id === focusId);
  if (idx > 0) store.selFocusId = flat[idx - 1].id;
  store.suppressSelectionClear = true;
  updateSelectionDisplay();
}

export function expandSelectionDown(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const flat = flatVisibleNodes(currentRoot);
  if (!store.selAnchorId) store.selAnchorId = node.id;
  const focusId = store.selFocusId || node.id;
  const idx = flat.findIndex(n => n.id === focusId);
  if (idx < flat.length - 1) store.selFocusId = flat[idx + 1].id;
  store.suppressSelectionClear = true;
  updateSelectionDisplay();
}

// ===== Collapse / Expand =====

export function collapseNode(node: BloomlineNode, render: () => void): void {
  if (node.children.length > 0) {
    recordHistory();
    node.collapsed = true;
    store.lastFocusId = node.id;
    render();
  }
}

export function expandNode(node: BloomlineNode, render: () => void): void {
  if (node.children.length > 0) {
    recordHistory();
    node.collapsed = false;
    store.lastFocusId = node.id;
    render();
  }
}

export function toggleCollapse(node: BloomlineNode, render: () => void): void {
  if (node.children.length > 0) {
    recordHistory();
    node.collapsed = !node.collapsed;
    store.lastFocusId = node.id;
    render();
  }
}

/** 親ノードを折りたたむ。実際に操作した場合 true を返す。 */
export function collapseParent(
  node: BloomlineNode,
  currentRoot: BloomlineNode,
  render: () => void,
): boolean {
  const res = findNode(node.id, currentRoot);
  if (res && res.parent && res.parent !== currentRoot) {
    recordHistory();
    res.parent.collapsed = true;
    store.lastFocusId = res.parent.id;
    store.lastFocusOffset = 0;
    render();
    return true;
  }
  return false;
}

// ===== Zoom =====

export function zoomIn(node: BloomlineNode, render: () => void): void {
  const path = getPathToNode(node.id);
  if (path) { store.state.currentPath = path; render(); }
}

export function zoomOut(render: () => void): void {
  if (store.state.currentPath.length > 0) { store.state.currentPath.pop(); render(); }
}

// ===== Focus movement =====

function focusNodeText(el: HTMLElement, pos: 'start' | 'end'): void {
  if (el.contentEditable === 'false') el.contentEditable = 'true';
  el.focus();
  const len = el.textContent!.length;
  setCursorPos(el, pos === 'end' ? len : 0);
}

export function moveFocusPrev(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const flat = flatVisibleNodes(currentRoot);
  const idx = flat.findIndex(n => n.id === node.id);
  if (idx <= 0) return;
  const prevNode = flat[idx - 1];
  const el = document.querySelector(`[data-id="${prevNode.id}"] .node-text`) as HTMLElement | null;
  if (el) focusNodeText(el, 'end');
}

export function moveFocusNext(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const flat = flatVisibleNodes(currentRoot);
  const idx = flat.findIndex(n => n.id === node.id);
  if (idx < 0 || idx >= flat.length - 1) return;
  const nextNode = flat[idx + 1];
  const el = document.querySelector(`[data-id="${nextNode.id}"] .node-text`) as HTMLElement | null;
  if (el) focusNodeText(el, 'start');
}

// ===== Clipboard =====

export function deepCloneNode(node: BloomlineNode): BloomlineNode {
  return {
    ...node,
    id: uuid(),
    children: node.children.map(deepCloneNode),
  };
}

export function nodesToText(nodes: BloomlineNode[], indent = 0): string {
  return nodes.map(n => {
    const line = '  '.repeat(indent) + n.text;
    const children = nodesToText(n.children, indent + 1);
    return children ? line + '\n' + children : line;
  }).join('\n');
}

function copyToOsClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function copySelectedNodes(sel: BloomlineNode[]): void {
  store.clipboardNodes = sel.map(deepCloneNode);
  store.clipboardText = nodesToText(sel);
  store.clipboardIsCut = false;
  copyToOsClipboard(store.clipboardText);
}

export function cutSelectedNodes(
  sel: BloomlineNode[],
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  store.clipboardNodes = sel.map(deepCloneNode);
  store.clipboardText = nodesToText(sel);
  store.clipboardIsCut = true;
  copyToOsClipboard(store.clipboardText);
  recordHistory();
  const flat = flatVisibleNodes(currentRoot);
  const lastFocus = flat.find(
    n => !sel.find(s => s.id === n.id) &&
         flat.indexOf(n) < flat.indexOf(sel[0])
  ) || flat.find(n => !sel.find(s => s.id === n.id));
  for (let i = sel.length - 1; i >= 0; i--) {
    const res = findNode(sel[i].id, currentRoot);
    if (res && !(res.parent === currentRoot && res.parent!.children.length === 1)) {
      res.parent!.children.splice(res.index, 1);
    }
  }
  clearSelection();
  if (lastFocus) { store.lastFocusId = lastFocus.id; store.lastFocusOffset = lastFocus.text.length; }
  render();
}

// ===== Misc =====

export function toggleHideChecked(): void {
  store.hideChecked = !store.hideChecked;
  applySearch();
  showToast(store.hideChecked ? '完了タスクを非表示にしました' : '完了タスクを表示しました');
}

export function wrapWithMarkdown(
  textEl: HTMLElement,
  node: BloomlineNode,
  marker: string,
  render: () => void,
): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  const selectedText = range.toString();
  const text = node.text;

  if (selectedText) {
    const pre = range.cloneRange();
    pre.selectNodeContents(textEl);
    pre.setEnd(range.startContainer, range.startOffset);
    const selStart = pre.toString().length;
    const selEnd = selStart + selectedText.length;

    node.text = text.slice(0, selStart) + marker + selectedText + marker + text.slice(selEnd);
    store.lastFocusId = node.id;
    store.lastFocusOffset = selEnd + marker.length * 2;
  } else {
    const pos = getCursorPos(textEl);
    node.text = text.slice(0, pos) + marker + marker + text.slice(pos);
    store.lastFocusId = node.id;
    store.lastFocusOffset = pos + marker.length;
  }
  recordHistory();
  render();
}

// ===== Dispatch =====

export type ActionName =
  | 'emacsBackward' | 'emacsForward' | 'emacsLineStart' | 'emacsLineEnd'
  | 'emacsFocusPrev' | 'emacsFocusNext'
  | 'emacsDeleteForward' | 'emacsDeleteBackward' | 'emacsDeleteToEol'
  | 'toggleChecked' | 'openNote' | 'splitNode'
  | 'indentNode' | 'outdentNode'
  | 'backspace' | 'deleteNode'
  | 'expandSelectionUp' | 'expandSelectionDown'
  | 'collapseNode' | 'expandNode'
  | 'moveNodeUp' | 'moveNodeDown'
  | 'focusPrev' | 'focusNext'
  | 'escape'
  | 'collapseParent' | 'zoomIn' | 'zoomOut'
  | 'toggleCollapse'
  | 'outdentNodeAlt' | 'indentNodeAlt'
  | 'toggleHideChecked'
  | 'wrapBold' | 'wrapItalic' | 'wrapUnderline'
  | 'copy' | 'cut';

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

/**
 * キーイベントをアクション名に変換する純粋関数。
 * DOM や store に依存しないためユニットテストが書ける。
 * プレーンオブジェクトも受け取れるので node 環境でテスト可能。
 */
export function resolveAction(e: KeyEventLike, isMac: boolean): ActionName | null {
  const { key, ctrlKey = false, metaKey = false, altKey = false, shiftKey = false, isComposing = false } = e;

  // Mac Emacs-like bindings (Ctrl のみ、Meta/Alt/Shift/IME 変換中は除外)
  if (isMac && ctrlKey && !metaKey && !altKey && !shiftKey && !isComposing) {
    if (key === 'b') return 'emacsBackward';
    if (key === 'f') return 'emacsForward';
    if (key === 'a') return 'emacsLineStart';
    if (key === 'e') return 'emacsLineEnd';
    if (key === 'p') return 'emacsFocusPrev';
    if (key === 'n') return 'emacsFocusNext';
    if (key === 'd') return 'emacsDeleteForward';
    if (key === 'h') return 'emacsDeleteBackward';
    if (key === 'k') return 'emacsDeleteToEol';
    // 未知のキーはフォールスルー（例: Ctrl+ArrowUp → collapseNode）
  }

  if (key === 'Enter' && (metaKey || ctrlKey) && !isComposing) return 'toggleChecked';
  if (key === 'Enter' && shiftKey && !isComposing)              return 'openNote';
  if (key === 'Enter' && !shiftKey && !isComposing)             return 'splitNode';

  if (key === 'Tab' && !shiftKey) return 'indentNode';
  if (key === 'Tab' && shiftKey)  return 'outdentNode';

  // deleteNode は Backspace catch-all より先にチェック
  if (key === 'Backspace' && (metaKey || ctrlKey) && shiftKey) return 'deleteNode';
  if (key === 'Backspace') return 'backspace';

  // ArrowUp/Down: 修飾キーが多いものを先にチェックして catch-all に落とさない
  if (key === 'ArrowUp'   && shiftKey && (altKey || metaKey)) return 'moveNodeUp';
  if (key === 'ArrowDown' && shiftKey && (altKey || metaKey)) return 'moveNodeDown';
  if (key === 'ArrowUp'   && shiftKey && !altKey && !metaKey) return 'expandSelectionUp';
  if (key === 'ArrowDown' && shiftKey && !altKey && !metaKey) return 'expandSelectionDown';
  if (key === 'ArrowUp'   && ctrlKey  && !shiftKey && !altKey) return 'collapseNode';
  if (key === 'ArrowDown' && ctrlKey  && !shiftKey && !altKey) return 'expandNode';
  if (key === 'ArrowUp')   return 'focusPrev';
  if (key === 'ArrowDown') return 'focusNext';

  if (key === 'Escape') return 'escape';

  if (key === 'ArrowRight' && (metaKey || ctrlKey) && !altKey && !shiftKey) return 'collapseParent';
  // Alt+Shift+Arrow は Alt+Arrow より先にチェック
  if (key === 'ArrowLeft'  && altKey && shiftKey)  return 'outdentNodeAlt';
  if (key === 'ArrowRight' && altKey && shiftKey)  return 'indentNodeAlt';
  if (key === 'ArrowRight' && altKey && !shiftKey) return 'zoomIn';
  if (key === 'ArrowLeft'  && altKey && !shiftKey) return 'zoomOut';

  if (key === ' ' && ctrlKey && !isComposing) return 'toggleCollapse';

  if (key === 'o' && (metaKey || ctrlKey) && !shiftKey) return 'toggleHideChecked';
  if (key === 'b' && (isMac ? metaKey : (metaKey || ctrlKey)) && !shiftKey) return 'wrapBold';
  if (key === 'i' && (isMac ? metaKey : (metaKey || ctrlKey)) && !shiftKey) return 'wrapItalic';
  if (key === 'u' && (isMac ? metaKey : (metaKey || ctrlKey)) && !shiftKey) return 'wrapUnderline';
  if (key === 'c' && (metaKey || ctrlKey) && !shiftKey) return 'copy';
  if (key === 'x' && (metaKey || ctrlKey) && !shiftKey) return 'cut';

  return null;
}

import { store } from './store';
import { createNode } from './model';
import {
  getCurrentRoot, findNode, flatVisibleNodes, getPathToNode,
} from './nodeHelpers';
import { getCursorPos, setCursorPos, isAtStart, isAtEnd } from './cursor';
import { getSelectionRange, clearSelection, updateSelectionDisplay } from './selection';
import { recordHistory, scheduleTextHistory } from './history';
import { applySearch } from './search';
import { showToast } from './toast';
import type { BloomlineNode } from './types';

let _render: (() => void) | null = null;

export function initEditor(renderFn: () => void): void {
  _render = renderFn;
}

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function handleKeyDown(
  e: KeyboardEvent,
  node: BloomlineNode,
  textEl: HTMLElement,
  noteEl: HTMLElement
): void {
  const currentRoot = getCurrentRoot();

  // Mac Emacs-like keybindings (Ctrl のみ、Meta/Alt/Shift/IME 変換中は除外)
  if (isMac && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !e.isComposing) {
    if (e.key === 'b') {
      e.preventDefault();
      const pos = getCursorPos(textEl);
      if (pos > 0) setCursorPos(textEl, pos - 1);
      return;
    } else if (e.key === 'f') {
      e.preventDefault();
      const pos = getCursorPos(textEl);
      if (pos < textEl.textContent!.length) setCursorPos(textEl, pos + 1);
      return;
    } else if (e.key === 'a') {
      e.preventDefault();
      setCursorPos(textEl, 0);
      return;
    } else if (e.key === 'e') {
      e.preventDefault();
      setCursorPos(textEl, textEl.textContent!.length);
      return;
    } else if (e.key === 'p') {
      e.preventDefault();
      clearSelection();
      moveFocusPrev(node, currentRoot);
      return;
    } else if (e.key === 'n') {
      e.preventDefault();
      clearSelection();
      moveFocusNext(node, currentRoot);
      return;
    } else if (e.key === 'd') {
      e.preventDefault();
      const pos = getCursorPos(textEl);
      const text = node.text;
      if (pos < text.length) {
        recordHistory();
        node.text = text.slice(0, pos) + text.slice(pos + 1);
        store.lastFocusId = node.id;
        store.lastFocusOffset = pos;
        _render?.();
      }
      return;
    } else if (e.key === 'h') {
      e.preventDefault();
      const pos = getCursorPos(textEl);
      const text = node.text;
      if (pos > 0) {
        recordHistory();
        node.text = text.slice(0, pos - 1) + text.slice(pos);
        store.lastFocusId = node.id;
        store.lastFocusOffset = pos - 1;
        _render?.();
      }
      return;
    } else if (e.key === 'k') {
      e.preventDefault();
      const pos = getCursorPos(textEl);
      if (pos < node.text.length) {
        recordHistory();
        node.text = node.text.slice(0, pos);
        store.lastFocusId = node.id;
        store.lastFocusOffset = pos;
        _render?.();
      }
      return;
    }
  }

  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) {
    e.preventDefault();
    if (node.checked !== undefined) {
      recordHistory();
      node.checked = !node.checked;
      store.lastFocusId = node.id;
      _render?.();
    }

  } else if (e.key === 'Enter' && e.shiftKey && !e.isComposing) {
    e.preventDefault();
    noteEl.classList.remove('hidden');
    noteEl.focus();
    const r = document.createRange();
    r.selectNodeContents(noteEl);
    r.collapse(false);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);

  } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
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
    _render?.();

  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    recordHistory();
    const sel = getSelectionRange();
    if (sel.length > 1) {
      for (let i = sel.length - 1; i >= 0; i--) indentNode(sel[i], currentRoot, true);
      clearSelection();
      _render?.();
    } else {
      indentNode(node, currentRoot);
    }

  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    recordHistory();
    const sel = getSelectionRange();
    if (sel.length > 1) {
      sel.forEach(n => outdentNode(n, currentRoot, true));
      clearSelection();
      _render?.();
    } else {
      outdentNode(node, currentRoot);
    }

  } else if (e.key === 'Backspace') {
    const sel = getSelectionRange();
    if (sel.length > 1) {
      e.preventDefault();
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
      _render?.();
    } else if (isAtStart(textEl)) {
      if (node.checked !== undefined) {
        e.preventDefault();
        recordHistory();
        node.checked = undefined;
        store.lastFocusId = node.id;
        store.lastFocusOffset = 0;
        _render?.();
      } else if (node.text === '' && node.children.length === 0) {
        e.preventDefault();
        removeNode(node, currentRoot);
      } else if (isAtStart(textEl)) {
        e.preventDefault();
        mergeWithPrev(node, textEl, currentRoot);
      }
    }

  } else if (e.key === 'ArrowUp' && e.shiftKey && !e.altKey) {
    e.preventDefault();
    const flat = flatVisibleNodes(currentRoot);
    if (!store.selAnchorId) store.selAnchorId = node.id;
    const focusId = store.selFocusId || node.id;
    const idx = flat.findIndex(n => n.id === focusId);
    if (idx > 0) store.selFocusId = flat[idx - 1].id;
    store.suppressSelectionClear = true;
    updateSelectionDisplay();

  } else if (e.key === 'ArrowDown' && e.shiftKey && !e.altKey) {
    e.preventDefault();
    const flat = flatVisibleNodes(currentRoot);
    if (!store.selAnchorId) store.selAnchorId = node.id;
    const focusId = store.selFocusId || node.id;
    const idx = flat.findIndex(n => n.id === focusId);
    if (idx < flat.length - 1) store.selFocusId = flat[idx + 1].id;
    store.suppressSelectionClear = true;
    updateSelectionDisplay();

  } else if (e.key === 'ArrowUp' && e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    if (node.children.length > 0) {
      recordHistory();
      node.collapsed = true;
      store.lastFocusId = node.id;
      _render?.();
    }

  } else if (e.key === 'ArrowDown' && e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    if (node.children.length > 0) {
      recordHistory();
      node.collapsed = false;
      store.lastFocusId = node.id;
      _render?.();
    }

  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    clearSelection();
    moveFocusPrev(node, currentRoot);

  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    clearSelection();
    moveFocusNext(node, currentRoot);

  } else if (e.key === 'Escape') {
    if (store.selAnchorId) { clearSelection(); }

  } else if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
    const res = findNode(node.id, currentRoot);
    if (res && res.parent && res.parent !== currentRoot) {
      e.preventDefault();
      recordHistory();
      res.parent.collapsed = true;
      store.lastFocusId = res.parent.id;
      store.lastFocusOffset = 0;
      _render?.();
    }

  } else if (e.key === 'ArrowRight' && e.altKey && !e.shiftKey) {
    e.preventDefault();
    const path = getPathToNode(node.id);
    if (path) { store.state.currentPath = path; _render?.(); }

  } else if (e.key === 'ArrowLeft' && e.altKey && !e.shiftKey) {
    e.preventDefault();
    if (store.state.currentPath.length > 0) { store.state.currentPath.pop(); _render?.(); }

  } else if (e.key === ' ' && e.ctrlKey && !e.isComposing) {
    e.preventDefault();
    if (node.children.length > 0) {
      recordHistory();
      node.collapsed = !node.collapsed;
      store.lastFocusId = node.id;
      _render?.();
    }

  } else if (e.key === 'ArrowUp' && e.altKey && e.shiftKey) {
    e.preventDefault();
    moveNodeUp(node, currentRoot);

  } else if (e.key === 'ArrowDown' && e.altKey && e.shiftKey) {
    e.preventDefault();
    moveNodeDown(node, currentRoot);

  } else if (e.key === 'ArrowLeft' && e.altKey && e.shiftKey) {
    e.preventDefault();
    recordHistory();
    outdentNode(node, currentRoot);

  } else if (e.key === 'ArrowRight' && e.altKey && e.shiftKey) {
    e.preventDefault();
    recordHistory();
    indentNode(node, currentRoot);

  } else if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
    e.preventDefault();
    removeNode(node, currentRoot);

  } else if (e.key === 'o' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
    e.preventDefault();
    toggleHideChecked();

  } else if (e.key === 'b' && (isMac ? e.metaKey : (e.metaKey || e.ctrlKey)) && !e.shiftKey) {
    e.preventDefault();
    wrapWithMarkdown(textEl, node, '**');

  } else if (e.key === 'i' && (isMac ? e.metaKey : (e.metaKey || e.ctrlKey)) && !e.shiftKey) {
    e.preventDefault();
    wrapWithMarkdown(textEl, node, '*');

  } else if (e.key === 'u' && (isMac ? e.metaKey : (e.metaKey || e.ctrlKey)) && !e.shiftKey) {
    e.preventDefault();
    wrapWithMarkdown(textEl, node, '__');
  }
}

export function handleNoteKeyDown(
  e: KeyboardEvent,
  _node: BloomlineNode,
  textEl: HTMLElement,
  _noteEl: HTMLElement
): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    textEl.focus();
  } else if (e.key === 'Enter' && e.shiftKey && !e.isComposing) {
    e.preventDefault();
    textEl.focus();
  }
}

export function indentNode(node: BloomlineNode, currentRoot: BloomlineNode, skipRender = false): void {
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
  if (!skipRender) _render?.();
}

export function outdentNode(node: BloomlineNode, currentRoot: BloomlineNode, skipRender = false): void {
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
  if (!skipRender) _render?.();
}

export function removeNode(node: BloomlineNode, currentRoot: BloomlineNode): void {
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
  _render?.();
}

export function mergeWithPrev(node: BloomlineNode, _textEl: HTMLElement, currentRoot: BloomlineNode): void {
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
  _render?.();
}

export function moveNodeUp(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (index === 0) return;
  recordHistory();
  parent!.children.splice(index, 1);
  parent!.children.splice(index - 1, 0, node);
  store.lastFocusId = node.id;
  _render?.();
}

export function moveNodeDown(node: BloomlineNode, currentRoot: BloomlineNode): void {
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  const { parent, index } = res;
  if (index >= parent!.children.length - 1) return;
  recordHistory();
  parent!.children.splice(index, 1);
  parent!.children.splice(index + 1, 0, node);
  store.lastFocusId = node.id;
  _render?.();
}

export function toggleHideChecked(): void {
  store.hideChecked = !store.hideChecked;
  applySearch();
  showToast(store.hideChecked ? '完了タスクを非表示にしました' : '完了タスクを表示しました');
}

export function wrapWithMarkdown(textEl: HTMLElement, node: BloomlineNode, marker: string): void {
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
  _render?.();
}

function focusNodeText(el: HTMLElement, pos: 'start' | 'end'): void {
  // contentEditable='false' の要素（URL等のインライン装飾中）は
  // focus() が無効になるブラウザがあるため、先に 'true' にする
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

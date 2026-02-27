import { store } from "./store";
import { getCurrentRoot, findNode, flatVisibleNodes } from "./nodeHelpers";
import { isAtStart, isOnFirstLine, isOnLastLine, getCursorClientX } from "./cursor";
import { getSelectionRange, clearSelection } from "./selection";
import { recordHistory } from "./history";
import { showToast } from "./toast";
import type { BloomlineNode } from "./types";
import {
  resolveAction,
  emacsBackward,
  emacsForward,
  emacsLineStart,
  emacsLineEnd,
  emacsDeleteForward,
  emacsDeleteBackward,
  emacsDeleteToEol,
  toggleChecked,
  openNote,
  splitNode,
  indentNode,
  outdentNode,
  removeNode,
  mergeWithPrev,
  moveNodeUp,
  moveNodeDown,
  expandSelectionUp,
  expandSelectionDown,
  collapseNode,
  expandNode,
  toggleCollapse,
  collapseParent,
  zoomIn,
  zoomOut,
  moveFocusPrev,
  moveFocusNext,
  toggleHideChecked,
  wrapWithMarkdown,
  deepCloneNode,
  copySelectedNodes,
  cutSelectedNodes,
} from "./keyHandlers";

let _render: (() => void) | null = null;

export function initEditor(renderFn: () => void): void {
  _render = renderFn;
}

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function handleBackspace(
  e: KeyboardEvent,
  node: BloomlineNode,
  textEl: HTMLElement,
  currentRoot: BloomlineNode,
  render: () => void,
): void {
  const sel = getSelectionRange();
  if (sel.length > 1) {
    e.preventDefault();
    recordHistory();
    const flat = flatVisibleNodes(currentRoot);
    const lastFocus =
      flat.find((n) => !sel.find((s) => s.id === n.id) && flat.indexOf(n) < flat.indexOf(sel[0])) ||
      flat.find((n) => !sel.find((s) => s.id === n.id));
    for (let i = sel.length - 1; i >= 0; i--) {
      const res = findNode(sel[i].id, currentRoot);
      if (res && !(res.parent === currentRoot && res.parent!.children.length === 1)) {
        res.parent!.children.splice(res.index, 1);
      }
    }
    clearSelection();
    if (lastFocus) {
      store.lastFocusId = lastFocus.id;
      store.lastFocusOffset = lastFocus.text.length;
    }
    render();
    return;
  }

  if (isAtStart(textEl)) {
    if (node.checked !== undefined) {
      e.preventDefault();
      recordHistory();
      node.checked = undefined;
      store.lastFocusId = node.id;
      store.lastFocusOffset = 0;
      render();
    } else if (node.text === "" && node.children.length === 0) {
      e.preventDefault();
      removeNode(node, currentRoot, render);
    } else {
      e.preventDefault();
      mergeWithPrev(node, textEl, currentRoot, render);
    }
  }
}

export function handleKeyDown(
  e: KeyboardEvent,
  node: BloomlineNode,
  textEl: HTMLElement,
  noteEl: HTMLElement,
): void {
  const action = resolveAction(e, isMac);
  if (action === null) return;

  const currentRoot = getCurrentRoot();
  const render = _render!;

  // Backspace: 条件により preventDefault が変わるため個別処理
  if (action === "backspace") {
    handleBackspace(e, node, textEl, currentRoot, render);
    return;
  }

  // Tab: 複数選択時はバッチ処理
  if (action === "indentNode") {
    e.preventDefault();
    recordHistory();
    const sel = getSelectionRange();
    if (sel.length > 1) {
      for (let i = sel.length - 1; i >= 0; i--) indentNode(sel[i], currentRoot, render, true);
      clearSelection();
      render();
    } else {
      indentNode(node, currentRoot, render);
    }
    return;
  }

  if (action === "outdentNode") {
    e.preventDefault();
    recordHistory();
    const sel = getSelectionRange();
    if (sel.length > 1) {
      sel.forEach((n) => outdentNode(n, currentRoot, render, true));
      clearSelection();
      render();
    } else {
      outdentNode(node, currentRoot, render);
    }
    return;
  }

  // collapseParent: 親が存在する場合のみ preventDefault
  if (action === "collapseParent") {
    if (collapseParent(node, currentRoot, render)) e.preventDefault();
    return;
  }

  // escape: 選択解除のみ（preventDefault しない）
  if (action === "escape") {
    if (store.selAnchorId) clearSelection();
    return;
  }

  // focusPrev / focusNext: 折り返し行の途中ではブラウザに任せ、最初/最後の行のみノード間移動
  if (action === "focusPrev") {
    if (isOnFirstLine(textEl)) {
      e.preventDefault();
      clearSelection();
      moveFocusPrev(node, currentRoot, getCursorClientX());
    }
    return;
  }

  if (action === "focusNext") {
    if (isOnLastLine(textEl)) {
      e.preventDefault();
      clearSelection();
      moveFocusNext(node, currentRoot, getCursorClientX());
    }
    return;
  }

  // copy/cut: 複数選択時のみ動作（単一選択はブラウザのデフォルト動作に任せる）
  if (action === "copy") {
    const sel = getSelectionRange();
    if (sel.length > 1) {
      e.preventDefault();
      copySelectedNodes(sel);
      showToast(`${sel.length} 件をコピーしました`);
    }
    return;
  }

  if (action === "cut") {
    const sel = getSelectionRange();
    if (sel.length > 1) {
      e.preventDefault();
      cutSelectedNodes(sel, currentRoot, render);
      showToast(`${store.clipboardNodes!.length} 件をカットしました`);
    }
    return;
  }

  // 残りのアクションはすべて preventDefault してから実行
  e.preventDefault();

  switch (action) {
    case "emacsBackward":
      emacsBackward(textEl);
      break;
    case "emacsForward":
      emacsForward(textEl);
      break;
    case "emacsLineStart":
      emacsLineStart(textEl);
      break;
    case "emacsLineEnd":
      emacsLineEnd(textEl);
      break;
    case "emacsFocusPrev":
      clearSelection();
      moveFocusPrev(node, currentRoot);
      break;
    case "emacsFocusNext":
      clearSelection();
      moveFocusNext(node, currentRoot);
      break;
    case "emacsDeleteForward":
      emacsDeleteForward(node, textEl, render);
      break;
    case "emacsDeleteBackward":
      emacsDeleteBackward(node, textEl, render);
      break;
    case "emacsDeleteToEol":
      emacsDeleteToEol(node, textEl, render);
      break;
    case "toggleChecked":
      toggleChecked(node, render);
      break;
    case "openNote":
      openNote(noteEl);
      break;
    case "splitNode":
      splitNode(node, textEl, currentRoot, render);
      break;
    case "deleteNode":
      removeNode(node, currentRoot, render);
      break;
    case "expandSelectionUp":
      expandSelectionUp(node, currentRoot);
      break;
    case "expandSelectionDown":
      expandSelectionDown(node, currentRoot);
      break;
    case "collapseNode":
      collapseNode(node, render);
      break;
    case "expandNode":
      expandNode(node, render);
      break;
    case "moveNodeUp":
      moveNodeUp(node, currentRoot, render);
      break;
    case "moveNodeDown":
      moveNodeDown(node, currentRoot, render);
      break;
    case "zoomIn":
      zoomIn(node, render);
      break;
    case "zoomOut":
      zoomOut(render);
      break;
    case "toggleCollapse":
      toggleCollapse(node, render);
      break;
    case "indentNodeAlt":
      recordHistory();
      indentNode(node, currentRoot, render);
      break;
    case "outdentNodeAlt":
      recordHistory();
      outdentNode(node, currentRoot, render);
      break;
    case "toggleHideChecked":
      toggleHideChecked();
      break;
    case "wrapBold":
      wrapWithMarkdown(textEl, node, "**", render);
      break;
    case "wrapItalic":
      wrapWithMarkdown(textEl, node, "*", render);
      break;
    case "wrapUnderline":
      wrapWithMarkdown(textEl, node, "__", render);
      break;
  }
}

// ペーストイベント：OS クリップボードのテキストが自分がコピーしたものと一致する場合のみノードペースト
export function handlePaste(e: ClipboardEvent, node: BloomlineNode): void {
  if (!store.clipboardNodes || !store.clipboardText) return;
  const pastedText = e.clipboardData?.getData("text") ?? "";
  if (pastedText !== store.clipboardText) return;

  e.preventDefault();
  const currentRoot = getCurrentRoot();
  const res = findNode(node.id, currentRoot);
  if (!res) return;
  recordHistory();
  const newNodes = store.clipboardNodes.map(deepCloneNode);
  res.parent!.children.splice(res.index + 1, 0, ...newNodes);
  clearSelection();
  store.lastFocusId = newNodes[0].id;
  _render?.();
  showToast(`${newNodes.length} 件をペーストしました`);
}

export function handleNoteKeyDown(
  e: KeyboardEvent,
  _node: BloomlineNode,
  textEl: HTMLElement,
  _noteEl: HTMLElement,
): void {
  if (e.key === "Escape") {
    e.preventDefault();
    textEl.focus();
  } else if (e.key === "Enter" && e.shiftKey && !e.isComposing) {
    e.preventDefault();
    textEl.focus();
  }
}

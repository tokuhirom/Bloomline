import { store } from './store';
import { saveState } from './model';
import { showToast } from './toast';

const MAX_UNDO = 100;
let undoStack: any[] = [];
let undoIdx = -1;
let undoInProgress = false;
let textHistoryTimer: ReturnType<typeof setTimeout> | null = null;

let _render: (() => void) | null = null;

export function initHistory(renderFn: () => void): void {
  _render = renderFn;
}

function snapshotForHistory() {
  return JSON.parse(JSON.stringify({
    root: store.state.root,
    currentPath: [...store.state.currentPath],
    title: store.state.title
  }));
}

export function recordHistory(): void {
  if (undoInProgress) return;
  if (textHistoryTimer) { clearTimeout(textHistoryTimer); textHistoryTimer = null; }
  undoStack = undoStack.slice(0, undoIdx + 1);
  undoStack.push(snapshotForHistory());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  else undoIdx++;
}

export function scheduleTextHistory(): void {
  if (undoInProgress) return;
  if (textHistoryTimer) clearTimeout(textHistoryTimer);
  textHistoryTimer = setTimeout(recordHistory, 1500);
}

export function undo(): void {
  if (textHistoryTimer) { clearTimeout(textHistoryTimer); textHistoryTimer = null; recordHistory(); }
  if (undoIdx <= 0) return;
  undoIdx--;
  undoInProgress = true;
  const snap = undoStack[undoIdx];
  store.state.root = snap.root;
  store.state.currentPath = snap.currentPath;
  store.state.title = snap.title;
  _render?.();
  saveState();
  undoInProgress = false;
  showToast('元に戻しました');
}

export function redo(): void {
  if (undoIdx >= undoStack.length - 1) return;
  undoIdx++;
  undoInProgress = true;
  const snap = undoStack[undoIdx];
  store.state.root = snap.root;
  store.state.currentPath = snap.currentPath;
  store.state.title = snap.title;
  _render?.();
  saveState();
  undoInProgress = false;
  showToast('やり直しました');
}

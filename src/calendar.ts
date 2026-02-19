import { store } from './store';
import { createNode, saveState } from './model';
import { getCurrentRoot, getPathToNode, flatVisibleNodes } from './nodeHelpers';
import { recordHistory } from './history';

let _render: (() => void) | null = null;

export function initCalendar(renderFn: () => void): void {
  _render = renderFn;
}

export function openCalendar(): void {
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthStr = `${yearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayStr = `${monthStr}-${String(now.getDate()).padStart(2, '0')}(${days[now.getDay()]})`;

  // Calendar ルートノードを探す
  let calRoot = store.state.root.children.find(n => n.calendarType === 'root');
  if (!calRoot) {
    recordHistory();
    calRoot = createNode('Calendar');
    calRoot.calendarType = 'root';
    store.state.root.children.push(calRoot);
  }

  // 年ノード
  let yearNode = calRoot.children.find(n => n.text === yearStr);
  if (!yearNode) {
    yearNode = createNode(yearStr);
    yearNode.calendarType = 'year';
    calRoot.children.push(yearNode);
    calRoot.collapsed = false;
  }

  // 月ノード
  let monthNode = yearNode.children.find(n => n.text === monthStr);
  if (!monthNode) {
    monthNode = createNode(monthStr);
    monthNode.calendarType = 'month';
    yearNode.children.push(monthNode);
    yearNode.collapsed = false;
  }

  // 日ノード
  let dayNode = monthNode.children.find(n => n.text === dayStr);
  if (!dayNode) {
    dayNode = createNode(dayStr);
    dayNode.calendarType = 'day';
    monthNode.children.push(dayNode);
    monthNode.collapsed = false;
  }

  // 現在の表示領域に日ノードが見えているか確認
  const visibleIds = new Set(flatVisibleNodes(getCurrentRoot()).map(n => n.id));
  if (visibleIds.has(dayNode.id)) {
    store.lastFocusId = dayNode.id;
    _render?.();
  } else {
    recordHistory();
    const path = getPathToNode(dayNode.id);
    if (path) store.state.currentPath = path;
    store.lastFocusId = dayNode.id;
    _render?.();
  }
  saveState();
}

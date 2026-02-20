import { store } from './store';
import { getCurrentRoot, getPathToNode, findNode, flatVisibleNodes, isDescendantOrSelf, moveNode, clearDropIndicators } from './nodeHelpers';
import { saveState } from './model';
import { renderSidebar } from './sidebar';
import { applySearch } from './search';
import { HAS_INLINE_RE, renderInlineContent, showRawText } from './inline';
import { refreshImagePreview } from './imagePreview';
import { setCursorPos } from './cursor';
import { updateSelectionDisplay, clearSelection, getSelectionRange } from './selection';
import { handleKeyDown, handleNoteKeyDown } from './editor';
import { recordHistory, scheduleTextHistory } from './history';
import type { BloomlineNode } from './types';

function updateToggleBtn(li: HTMLElement, node: BloomlineNode): void {
  const toggle = li.querySelector('.toggle-btn') as HTMLElement | null;
  if (!toggle) return;
  if (node.children.length === 0) {
    toggle.classList.add('no-children');
  } else {
    toggle.classList.remove('no-children');
    toggle.textContent = node.collapsed ? '▶' : '▼';
  }
}

export function render(): void {
  const currentRoot = getCurrentRoot();
  renderBreadcrumb(currentRoot);
  renderNodes(currentRoot);
  renderSidebar();
  saveState();
}

export function renderBreadcrumb(currentRoot: BloomlineNode): void {
  const bc = document.getElementById('breadcrumb')!;
  bc.innerHTML = '';

  const homeSpan = document.createElement('span');
  homeSpan.className = 'breadcrumb-item';
  homeSpan.textContent = store.state.title || 'Bloomline';
  homeSpan.addEventListener('click', () => { store.state.currentPath = []; render(); });
  bc.appendChild(homeSpan);

  let node = store.state.root;
  for (let i = 0; i < store.state.currentPath.length; i++) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = ' › ';
    bc.appendChild(sep);

    const id = store.state.currentPath[i];
    const child = node.children.find(c => c.id === id);
    if (!child) break;
    node = child;

    const isLast = (i === store.state.currentPath.length - 1);
    const span = document.createElement('span');
    span.className = isLast ? 'breadcrumb-current' : 'breadcrumb-item';
    span.textContent = child.text || '(無題)';
    if (!isLast) {
      const pathSoFar = store.state.currentPath.slice(0, i + 1);
      span.addEventListener('click', () => { store.state.currentPath = pathSoFar; render(); });
    }
    bc.appendChild(span);
  }

  const titleEl = document.getElementById('page-title')!;
  if (store.state.currentPath.length === 0) {
    if (document.activeElement !== titleEl) {
      titleEl.textContent = store.state.title || '';
    }
    titleEl.dataset.placeholder = 'タイトル';
    titleEl.style.display = '';
  } else {
    titleEl.style.display = 'none';
  }
}

export function renderNodes(currentRoot: BloomlineNode): void {
  const container = document.getElementById('node-root')!;
  container.innerHTML = '';
  currentRoot.children.forEach(child => {
    container.appendChild(createNodeEl(child, 0));
  });
  applySearch();

  if (store.lastFocusId) {
    const el = document.querySelector(`[data-id="${store.lastFocusId}"] .node-text`) as HTMLElement | null;
    if (el) {
      el.focus();
      if (store.lastFocusOffset !== null) {
        setCursorPos(el, store.lastFocusOffset);
      }
    }
    store.lastFocusId = null;
    store.lastFocusOffset = null;
  }
  if (store.selAnchorId) updateSelectionDisplay();
}

export function createNodeEl(node: BloomlineNode, depth: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'node-item';
  li.dataset.id = node.id;

  const row = document.createElement('div');
  row.className = 'node-row';

  // toggle button
  const toggle = document.createElement('span');
  toggle.className = 'toggle-btn' + (node.children.length === 0 ? ' no-children' : '');
  toggle.textContent = node.collapsed ? '▶' : '▼';
  toggle.title = node.collapsed ? '展開' : '折りたたむ';
  if (node.children.length > 0) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      node.collapsed = !node.collapsed;
      render();
    });
  }
  row.appendChild(toggle);

  // bullet
  const bullet = document.createElement('span');
  bullet.className = 'bullet';
  bullet.title = 'クリックでズームイン';
  const dot = document.createElement('span');
  dot.className = 'bullet-dot' + (node.collapsed && node.children.length > 0 ? ' has-children-collapsed' : '');
  bullet.appendChild(dot);
  bullet.addEventListener('click', (e) => {
    e.stopPropagation();
    const path = getPathToNode(node.id);
    if (path) store.state.currentPath = path;
    render();
  });

  bullet.draggable = true;
  bullet.addEventListener('dragstart', (e) => {
    e.dataTransfer!.setData('node-id', node.id);
    e.dataTransfer!.effectAllowed = 'all';
    bullet.classList.add('dragging');
    store.dragNodeId = node.id;
  });
  bullet.addEventListener('dragend', () => {
    bullet.classList.remove('dragging');
    store.dragNodeId = null;
    clearDropIndicators();
  });
  row.appendChild(bullet);

  // text area wrap
  const textWrap = document.createElement('div');
  textWrap.className = 'node-text-wrap';

  // main row (checkbox + text)
  const mainRow = document.createElement('div');
  mainRow.className = 'node-main-row';

  // checkbox (todo mode)
  if (node.checked !== undefined) {
    const cb = document.createElement('span');
    cb.className = 'node-checkbox' + (node.checked ? ' checked' : '');
    cb.title = node.checked ? 'チェックを外す' : '完了にする';
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      recordHistory();
      node.checked = !node.checked;
      store.lastFocusId = node.id;
      render();
    });
    mainRow.appendChild(cb);
  }

  const textEl = document.createElement('span');
  textEl.className = 'node-text' + (node.checked ? ' is-checked' : '');
  textEl.contentEditable = 'true';
  textEl.dataset.placeholder = node.checked !== undefined ? 'TODOを入力...' : '入力してください...';
  textEl.dataset.nodeId = node.id;
  textEl.spellcheck = false;
  // calendarType が year/month/day のノードは編集不可
  const isCalendarDateNode = ['year', 'month', 'day'].includes(node.calendarType ?? '');
  if (isCalendarDateNode) {
    textEl.contentEditable = 'false';
    textEl.textContent = node.text;
  } else if (HAS_INLINE_RE.test(node.text)) {
    renderInlineContent(textEl, node.text);
    textEl.contentEditable = 'false';
  } else {
    textEl.textContent = node.text;
  }

  const noteEl = document.createElement('span');
  noteEl.className = 'node-note' + (node.note ? '' : ' hidden');
  noteEl.contentEditable = 'true';
  noteEl.dataset.nodeId = node.id;
  noteEl.textContent = node.note;
  noteEl.spellcheck = false;

  const imgContainer = document.createElement('div');
  imgContainer.className = 'node-image-container';
  refreshImagePreview(imgContainer, node.text);

  textEl.addEventListener('input', () => {
    if (isCalendarDateNode) return;
    const raw = textEl.textContent!;
    if (/^\[\s?\] /.test(raw)) {
      node.checked = false;
      node.text = raw.replace(/^\[\s?\] /, '');
      store.lastFocusId = node.id;
      store.lastFocusOffset = 0;
      render();
      return;
    }
    node.text = raw;
    updateToggleBtn(li, node);
    refreshImagePreview(imgContainer, raw);
    scheduleTextHistory();
    saveState();
  });

  noteEl.addEventListener('input', () => {
    node.note = noteEl.textContent!;
    scheduleTextHistory();
    saveState();
  });

  textEl.addEventListener('keydown', (e) => handleKeyDown(e, node, textEl, noteEl));
  noteEl.addEventListener('keydown', (e) => handleNoteKeyDown(e, node, textEl, noteEl));

  textEl.addEventListener('focus', () => {
    if (isCalendarDateNode) { textEl.blur(); return; }
    textEl.contentEditable = 'true';
    row.classList.add('focused');
    if (!store.suppressSelectionClear) clearSelection();
    store.suppressSelectionClear = false;
    showRawText(textEl, node.text);
  });
  textEl.addEventListener('blur', () => {
    row.classList.remove('focused');
    if (!isCalendarDateNode && HAS_INLINE_RE.test(node.text)) {
      renderInlineContent(textEl, node.text);
      textEl.contentEditable = 'false';
    }
  });
  textEl.addEventListener('click', () => {
    if (isCalendarDateNode) return;
    if (textEl.contentEditable === 'false') {
      textEl.contentEditable = 'true';
      showRawText(textEl, node.text);
      textEl.focus();
    }
  });

  // テキスト右余白クリック時に編集モードに入りカーソルを末尾へ
  mainRow.addEventListener('click', (e) => {
    if (isCalendarDateNode) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.classList.contains('node-checkbox')) return;
    if (target === textEl || textEl.contains(target)) return;
    if (textEl.contentEditable === 'false') {
      textEl.contentEditable = 'true';
      showRawText(textEl, node.text);
    }
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  // 範囲選択（Shift+クリック & ドラッグ）
  row.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
      if (!store.selAnchorId) store.selAnchorId = node.id;
      store.selFocusId = node.id;
      store.suppressSelectionClear = true;
      updateSelectionDisplay();
      textEl.focus();
    } else {
      store.dragAnchorId = node.id;
      store.isDragging = true;
    }
  });

  // ノード移動ドロップ
  row.addEventListener('dragover', (e) => {
    if (!store.dragNodeId || store.dragNodeId === node.id) return;
    if (isDescendantOrSelf(store.dragNodeId, node.id)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    clearDropIndicators();
    const rect = row.getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.3)      row.classList.add('drop-above');
    else if (pct > 0.7) row.classList.add('drop-below');
    else                row.classList.add('drop-child');
  });
  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget as Node)) {
      row.classList.remove('drop-above', 'drop-below', 'drop-child');
    }
  });
  row.addEventListener('drop', (e) => {
    const srcId = e.dataTransfer!.getData('node-id');
    if (!srcId || srcId === node.id) return;
    if (isDescendantOrSelf(srcId, node.id)) return;
    e.preventDefault();
    e.stopPropagation();
    clearDropIndicators();
    const rect = row.getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    const position = pct < 0.3 ? 'before' : pct > 0.7 ? 'after' : 'child';
    recordHistory();
    moveNode(srcId, node.id, position);
    render();
  });

  row.addEventListener('mouseover', () => {
    if (!store.isDragging || !store.dragAnchorId || node.id === store.dragAnchorId) return;
    if (!store.selAnchorId) {
      store.selAnchorId = store.dragAnchorId;
      document.body.classList.add('node-drag-selecting');
      window.getSelection()?.removeAllRanges();
    }
    store.selFocusId = node.id;
    updateSelectionDisplay();
  });

  mainRow.appendChild(textEl);
  textWrap.appendChild(mainRow);
  textWrap.appendChild(noteEl);
  textWrap.appendChild(imgContainer);
  row.appendChild(textWrap);
  li.appendChild(row);

  if (node.children.length > 0) {
    const childList = document.createElement('ul');
    childList.className = 'node-children node-list' + (node.collapsed ? ' collapsed' : '');
    node.children.forEach(child => {
      childList.appendChild(createNodeEl(child, depth + 1));
    });
    li.appendChild(childList);
  }

  return li;
}

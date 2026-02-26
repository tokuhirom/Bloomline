import { store } from './store';
import { getCurrentRoot, getPathToNode, findNode, flatVisibleNodes, isDescendantOrSelf, moveNode, clearDropIndicators } from './nodeHelpers';
import { saveState } from './model';
import { renderSidebar } from './sidebar';
import { applySearch } from './search';
import { HAS_INLINE_RE, renderInlineContent, showRawText } from './inline';
import { refreshImagePreview } from './imagePreview';
import { setCursorPos } from './cursor';
import { updateSelectionDisplay, clearSelection, getSelectionRange } from './selection';
import { handleKeyDown, handleNoteKeyDown, removeNode } from './editor';
import { recordHistory, scheduleTextHistory } from './history';
import { showToast } from './toast';
import type { BloomlineNode } from './types';

// ===== Move to モーダル =====
function flatAllNodes(
  node: BloomlineNode,
  breadcrumb: string[] = []
): { node: BloomlineNode; breadcrumb: string[] }[] {
  const result: { node: BloomlineNode; breadcrumb: string[] }[] = [];
  node.children.forEach(child => {
    result.push({ node: child, breadcrumb });
    result.push(...flatAllNodes(child, [...breadcrumb, child.text || '(無題)']));
  });
  return result;
}

function showMoveToModal(srcNode: BloomlineNode): void {
  // backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'moveto-backdrop';

  const dialog = document.createElement('div');
  dialog.id = 'moveto-dialog';

  const input = document.createElement('input');
  input.id = 'moveto-input';
  input.type = 'text';
  input.placeholder = 'ノードを検索...';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const list = document.createElement('div');
  list.id = 'moveto-list';

  dialog.appendChild(input);
  dialog.appendChild(list);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  let selectedIndex = 0;
  let currentResults: { node: BloomlineNode; breadcrumb: string[] }[] = [];

  function close(): void {
    backdrop.remove();
  }

  function commit(target: BloomlineNode): void {
    if (target.id === srcNode.id) return;
    if (isDescendantOrSelf(srcNode.id, target.id)) {
      showToast('子孫ノードには移動できません');
      return;
    }
    close();
    recordHistory();
    moveNode(srcNode.id, target.id, 'child');
    render();
  }

  function renderList(query: string): void {
    const all = flatAllNodes(store.state.root);
    currentResults = query.trim()
      ? all.filter(({ node }) => node.text.toLowerCase().includes(query.toLowerCase()) && node.id !== srcNode.id)
      : all.filter(({ node }) => node.id !== srcNode.id);
    selectedIndex = 0;
    list.innerHTML = '';
    if (currentResults.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'moveto-empty';
      empty.textContent = '一致するノードがありません';
      list.appendChild(empty);
      return;
    }
    currentResults.forEach(({ node, breadcrumb }, i) => {
      const item = document.createElement('div');
      item.className = 'moveto-item' + (i === 0 ? ' selected' : '');
      item.dataset.index = String(i);

      const label = document.createElement('div');
      label.className = 'moveto-item-label';
      label.textContent = node.text || '(無題)';

      const path = document.createElement('div');
      path.className = 'moveto-item-path';
      path.textContent = breadcrumb.length > 0 ? breadcrumb.join(' › ') : '(ルート)';

      item.appendChild(label);
      item.appendChild(path);
      item.addEventListener('mousedown', e => { e.preventDefault(); commit(node); });
      item.addEventListener('mousemove', () => {
        list.querySelectorAll('.moveto-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedIndex = i;
      });
      list.appendChild(item);
    });
  }

  function updateSelection(): void {
    list.querySelectorAll('.moveto-item').forEach((el, i) => {
      el.classList.toggle('selected', i === selectedIndex);
      if (i === selectedIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  input.addEventListener('input', () => renderList(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) commit(currentResults[selectedIndex].node);
    }
  });

  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });

  renderList('');
  requestAnimationFrame(() => input.focus());
}

// ===== ノードコンテキストメニュー =====
let nodeMenuEl: HTMLDivElement | null = null;

export function initNodeMenu(): void {
  nodeMenuEl = document.createElement('div');
  nodeMenuEl.id = 'node-menu';
  nodeMenuEl.style.display = 'none';
  document.body.appendChild(nodeMenuEl);
  document.addEventListener('click', hideNodeMenu);
}

function hideNodeMenu(): void {
  if (nodeMenuEl) nodeMenuEl.style.display = 'none';
}

function showNodeMenu(node: BloomlineNode, anchorEl: HTMLElement): void {
  if (!nodeMenuEl) return;
  nodeMenuEl.innerHTML = '';

  const items: { label: string; action: () => void }[] = [
    {
      label: 'コピー',
      action: () => {
        navigator.clipboard.writeText(node.text).then(() => {
          showToast('コピーしました');
        });
      },
    },
    {
      label: '移動する...',
      action: () => showMoveToModal(node),
    },
    {
      label: 'お気に入りに追加',
      action: () => {
        if (store.state.pinnedItems.includes(node.id)) {
          showToast('すでに登録済みです');
        } else {
          store.state.pinnedItems.push(node.id);
          saveState();
          renderSidebar();
          showToast('お気に入りに追加しました');
        }
      },
    },
    { label: 'sep', action: () => {} },
    {
      label: '削除',
      action: () => {
        const currentRoot = getCurrentRoot();
        removeNode(node, currentRoot);
      },
    },
  ];

  items.forEach(item => {
    if (item.label === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'node-menu-sep';
      nodeMenuEl!.appendChild(sep);
      return;
    }
    const el = document.createElement('div');
    el.className = 'node-menu-item' + (item.label === '削除' ? ' node-menu-item-danger' : '');
    el.textContent = item.label;
    el.addEventListener('click', e => {
      e.stopPropagation();
      hideNodeMenu();
      item.action();
    });
    nodeMenuEl!.appendChild(el);
  });

  nodeMenuEl.style.display = '';
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 4;
  nodeMenuEl.style.left = `${left}px`;
  nodeMenuEl.style.top = `${top}px`;

  // 画面端からはみ出す場合の調整
  requestAnimationFrame(() => {
    if (!nodeMenuEl) return;
    const mr = nodeMenuEl.getBoundingClientRect();
    if (mr.right > window.innerWidth) nodeMenuEl.style.left = `${left - mr.width + anchorEl.offsetWidth}px`;
    if (mr.bottom > window.innerHeight) nodeMenuEl.style.top = `${rect.top - mr.height - 4}px`;
  });
}

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

  // actions menu button (⋯)
  const menuBtn = document.createElement('span');
  menuBtn.className = 'node-menu-btn';
  menuBtn.textContent = '⋯';
  menuBtn.title = 'アクション';
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    showNodeMenu(node, menuBtn);
  });
  row.appendChild(menuBtn);

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

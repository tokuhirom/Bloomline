import { store } from './store';
import { findNode, getPathToNode } from './nodeHelpers';

let _render: (() => void) | null = null;
let _saveState: (() => void) | null = null;

let sidebarVisible = true;
let sidebarDragSrcIndex: number | null = null;

export function initSidebar(renderFn: () => void, saveStateFn: () => void): void {
  _render = renderFn;
  _saveState = saveStateFn;
}

export function renderSidebar(): void {
  const zone = document.getElementById('sidebar-drop-zone')!;
  const empty = document.getElementById('sidebar-empty')!;
  zone.querySelectorAll('.sidebar-item').forEach(el => el.remove());

  store.state.pinnedItems = store.state.pinnedItems.filter(id => !!findNode(id));

  if (store.state.pinnedItems.length === 0) {
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    store.state.pinnedItems.forEach((nodeId, index) => {
      const found = findNode(nodeId);
      if (!found) return;
      const node = found.node;

      const item = document.createElement('div');
      item.className = 'sidebar-item';
      item.draggable = true;
      item.dataset.index = String(index);

      const label = document.createElement('span');
      label.className = 'sidebar-item-label';
      label.textContent = node.text || '(無題)';
      label.title = node.text || '(無題)';

      const removeBtn = document.createElement('span');
      removeBtn.className = 'sidebar-item-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = '削除';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.state.pinnedItems.splice(index, 1);
        _saveState?.();
        renderSidebar();
      });

      item.appendChild(label);
      item.appendChild(removeBtn);

      item.addEventListener('click', () => {
        const path = getPathToNode(nodeId);
        if (path) { store.state.currentPath = path; _render?.(); }
      });

      item.addEventListener('dragstart', (e) => {
        sidebarDragSrcIndex = index;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('sidebar-index', String(index));
        e.stopPropagation();
      });
      item.addEventListener('dragover', (e) => {
        if (sidebarDragSrcIndex === null) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        if (sidebarDragSrcIndex === null || sidebarDragSrcIndex === index) return;
        const rect = item.getBoundingClientRect();
        const insertAfter = e.clientY >= rect.top + rect.height / 2;
        const [moved] = store.state.pinnedItems.splice(sidebarDragSrcIndex, 1);
        const insertAt = sidebarDragSrcIndex < index
          ? (insertAfter ? index : index - 1)
          : (insertAfter ? index + 1 : index);
        store.state.pinnedItems.splice(insertAt, 0, moved);
        sidebarDragSrcIndex = null;
        _saveState?.();
        renderSidebar();
      });
      item.addEventListener('dragend', () => {
        sidebarDragSrcIndex = null;
        document.querySelectorAll('.sidebar-item').forEach(el =>
          el.classList.remove('drag-over-top', 'drag-over-bottom'));
      });

      zone.appendChild(item);
    });
  }
}

export function toggleSidebar(): void {
  sidebarVisible = !sidebarVisible;
  document.getElementById('sidebar')!.classList.toggle('hidden', !sidebarVisible);
}

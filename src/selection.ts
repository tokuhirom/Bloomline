import { store } from './store';
import { flatVisibleNodes, getCurrentRoot } from './nodeHelpers';
import type { BloomlineNode } from './types';

export function getSelectionRange(): BloomlineNode[] {
  if (!store.selAnchorId) return [];
  const flat = flatVisibleNodes(getCurrentRoot());
  const ai = flat.findIndex(n => n.id === store.selAnchorId);
  const fi = store.selFocusId ? flat.findIndex(n => n.id === store.selFocusId) : ai;
  if (ai < 0) return [];
  const start = Math.min(ai, fi < 0 ? ai : fi);
  const end   = Math.max(ai, fi < 0 ? ai : fi);
  return flat.slice(start, end + 1);
}

export function updateSelectionDisplay(): void {
  const ids = new Set(getSelectionRange().map(n => n.id));
  document.querySelectorAll('.node-row').forEach(row => {
    const li = row.closest('.node-item') as HTMLElement | null;
    (row as HTMLElement).classList.toggle('selected', li ? ids.has(li.dataset.id!) : false);
  });
}

export function clearSelection(): void {
  store.selAnchorId = null;
  store.selFocusId  = null;
  document.querySelectorAll('.node-row.selected').forEach(r => r.classList.remove('selected'));
}

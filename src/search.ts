import { store } from './store';
import { findNode, getCurrentRoot } from './nodeHelpers';
import { HAS_INLINE_RE, renderInlineContent } from './inline';

export function applySearch(): void {
  const q = store.searchQuery.trim().toLowerCase();
  if (!q) {
    document.querySelectorAll('.node-item').forEach(li => {
      const id = (li as HTMLElement).dataset.id!;
      const n = findNode(id)?.node;
      const isHiddenByChecked = store.hideChecked && n && n.checked === true;
      li.classList.toggle('search-hidden', !!isHiddenByChecked);
    });
    document.querySelectorAll('.node-text, .node-note').forEach(el => {
      const nodeId = (el as HTMLElement).dataset.nodeId;
      const node = nodeId ? findNode(nodeId)?.node : null;
      if (!node) return;
      if (el.classList.contains('node-text')) {
        if (HAS_INLINE_RE.test(node.text) && (el as HTMLElement).contentEditable !== 'true') {
          renderInlineContent(el as HTMLElement, node.text);
          (el as HTMLElement).contentEditable = 'false';
        } else if ((el as HTMLElement).contentEditable === 'true') {
          // 編集中はテキストのまま（触らない）
        } else {
          el.textContent = node.text;
        }
      } else {
        el.textContent = node.note;
      }
    });
    return;
  }

  const currentRoot = getCurrentRoot();
  const matchIds = new Set<string>();

  function collectMatch(node: any): boolean {
    const textMatch = node.text.toLowerCase().includes(q);
    const noteMatch = node.note.toLowerCase().includes(q);
    let childMatch = false;
    node.children.forEach((child: any) => {
      if (collectMatch(child)) childMatch = true;
    });
    if (textMatch || noteMatch || childMatch) {
      matchIds.add(node.id);
      return true;
    }
    return false;
  }
  currentRoot.children.forEach(collectMatch);

  document.querySelectorAll('.node-item').forEach(li => {
    const id = (li as HTMLElement).dataset.id!;
    const n = findNode(id)?.node;
    const isHiddenByChecked = store.hideChecked && n && n.checked === true;
    if (!matchIds.has(id) || isHiddenByChecked) {
      li.classList.add('search-hidden');
    } else {
      li.classList.remove('search-hidden');
    }
  });

  document.querySelectorAll('.node-text, .node-note').forEach(el => {
    const nodeId = (el as HTMLElement).dataset.nodeId;
    const node = nodeId ? findNode(nodeId)?.node : null;
    if (!node) return;
    const raw = el.classList.contains('node-text') ? node.text : node.note;
    el.innerHTML = highlightText(raw, q);
  });
}

export function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map(p => p.toLowerCase() === query ? `<mark>${escapeHtml(p)}</mark>` : escapeHtml(p)).join('');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { store } from './store';
import type { BloomlineNode, DropPosition } from './types';

export function getCurrentRoot(): BloomlineNode {
  let node = store.state.root;
  for (const id of store.state.currentPath) {
    const child = node.children.find(c => c.id === id);
    if (!child) { store.state.currentPath = []; return store.state.root; }
    node = child;
  }
  return node;
}

export function isDescendantOrSelf(srcId: string, targetId: string): boolean {
  const res = findNode(srcId);
  if (!res) return false;
  function check(n: BloomlineNode): boolean {
    if (n.id === targetId) return true;
    return n.children.some(check);
  }
  return check(res.node);
}

// moveNode does NOT call render(); the caller must do so
export function moveNode(srcId: string, targetId: string, position: DropPosition): void {
  const currentRoot = getCurrentRoot();
  const srcRes = findNode(srcId, currentRoot);
  if (!srcRes) return;
  const srcNode = srcRes.node;

  srcRes.parent!.children.splice(srcRes.index, 1);

  const tgtRes = findNode(targetId, currentRoot);
  if (!tgtRes) return;

  if (position === 'child') {
    if (tgtRes.node.collapsed) tgtRes.node.collapsed = false;
    tgtRes.node.children.unshift(srcNode);
  } else if (position === 'before') {
    tgtRes.parent!.children.splice(tgtRes.index, 0, srcNode);
  } else {
    tgtRes.parent!.children.splice(tgtRes.index + 1, 0, srcNode);
  }

  store.lastFocusId = srcId;
}

export function clearDropIndicators(): void {
  document.querySelectorAll('.node-row.drop-above, .node-row.drop-below, .node-row.drop-child')
    .forEach(el => el.classList.remove('drop-above', 'drop-below', 'drop-child'));
}

export function getPathToNode(targetId: string, current = store.state.root, path: string[] = []): string[] | null {
  for (const child of current.children) {
    if (child.id === targetId) return [...path, child.id];
    const result = getPathToNode(targetId, child, [...path, child.id]);
    if (result !== null) return result;
  }
  return null;
}

export function findNode(
  id: string,
  node: BloomlineNode = store.state.root,
  parent: BloomlineNode | null = null,
  index = 0
): { node: BloomlineNode; parent: BloomlineNode | null; index: number } | null {
  if (node.id === id) return { node, parent, index };
  for (let i = 0; i < node.children.length; i++) {
    const res = findNode(id, node.children[i], node, i);
    if (res) return res;
  }
  return null;
}

export function flatVisibleNodes(root: BloomlineNode): BloomlineNode[] {
  const list: BloomlineNode[] = [];
  function walk(node: BloomlineNode) {
    list.push(node);
    if (!node.collapsed) {
      node.children.forEach(walk);
    }
  }
  root.children.forEach(walk);
  return list;
}

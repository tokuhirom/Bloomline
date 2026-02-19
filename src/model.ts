import { store } from './store';
import type { BloomlineNode, AppState } from './types';

export const STORAGE_KEY = 'bloomline-data';

let _writeToFile: (() => void) | null = null;

export function initModel(writeToFileFn: () => void): void {
  _writeToFile = writeToFileFn;
}

export function uuid(): string {
  return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

export function createNode(text = '', checked?: boolean): BloomlineNode {
  return { id: uuid(), text, note: '', children: [], collapsed: false, checked };
}

function defaultState(): AppState {
  const root = createNode('');
  root.children.push(createNode(''));
  return { root, currentPath: [], title: 'Bloomline', pinnedItems: [], version: 1 };
}

export function migrateState(s: any): AppState {
  if (!s.currentPath) s.currentPath = [];
  if (!s.title) s.title = 'Bloomline';
  if (!s.version) s.version = 1;
  if (!s.pinnedItems) s.pinnedItems = [];
  ensureNodeFields(s.root);
  return s as AppState;
}

function ensureNodeFields(node: any): void {
  if (!node.id) node.id = uuid();
  if (!node.text) node.text = '';
  if (!node.note) node.note = '';
  if (!node.children) node.children = [];
  if (node.collapsed === undefined) node.collapsed = false;
  node.children.forEach(ensureNodeFields);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.root) return migrateState(s);
    }
  } catch (e) {}
  return defaultState();
}

export function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
  } catch (e) {}
  _writeToFile?.();
}

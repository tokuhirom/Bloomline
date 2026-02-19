import { store } from './store';
import { migrateState } from './model';
import { showToast } from './toast';

let _render: (() => void) | null = null;
let _saveState: (() => void) | null = null;

let fileHandle: any = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export const hasFileSystemAccess = 'showOpenFilePicker' in window;

export function initFileSystem(renderFn: () => void, saveStateFn: () => void): void {
  _render = renderFn;
  _saveState = saveStateFn;
}

export function updateFileInfo(status = 'saved'): void {
  const el = document.getElementById('file-info')!;
  if (!fileHandle) {
    el.textContent = '';
    el.className = '';
    return;
  }
  if (status === 'saving') {
    el.textContent = '⟳ ' + fileHandle.name + ' に保存中...';
    el.className = 'saving';
  } else {
    el.textContent = '✓ ' + fileHandle.name + ' に自動保存中';
    el.className = 'saved';
  }
}

export function writeToFile(): void {
  if (!fileHandle) return;
  updateFileInfo('saving');
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(store.state, null, 2));
      await writable.close();
      updateFileInfo('saved');
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        showToast('ファイルへの書き込み権限がありません');
        fileHandle = null;
        updateFileInfo();
      }
    }
  }, 600);
}

export async function openFile(): Promise<void> {
  if (!hasFileSystemAccess) {
    showToast('このブラウザはFile System Access APIに対応していません（Chrome/Edgeをお使いください）');
    return;
  }
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: 'Bloomline JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.root) throw new Error('Bloomlineのファイルではありません');
    fileHandle = handle;
    store.state = migrateState(parsed);
    _saveState?.();
    _render?.();
    updateFileInfo();
    showToast(handle.name + ' を開きました');
  } catch (e: any) {
    if (e.name !== 'AbortError') showToast('開けませんでした: ' + e.message);
  }
}

export async function saveFileAs(): Promise<void> {
  if (!hasFileSystemAccess) {
    showToast('このブラウザはFile System Access APIに対応していません（Chrome/Edgeをお使いください）');
    return;
  }
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: (store.state.title || 'bloomline') + '.json',
      types: [{ description: 'Bloomline JSON', accept: { 'application/json': ['.json'] } }]
    });
    fileHandle = handle;
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(store.state, null, 2));
    await writable.close();
    updateFileInfo();
    showToast(handle.name + ' に保存しました');
  } catch (e: any) {
    if (e.name !== 'AbortError') showToast('保存に失敗しました: ' + e.message);
  }
}

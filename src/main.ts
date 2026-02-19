import './style.css';
import { store } from './store';
import { loadState, saveState, createNode, initModel } from './model';
import { render, renderBreadcrumb } from './render';
import { renderSidebar, toggleSidebar, initSidebar } from './sidebar';
import { initEditor } from './editor';
import { initHistory, recordHistory, undo, redo } from './history';
import { scheduleTextHistory } from './history';
import { initFileSystem, openFile, saveFileAs, hasFileSystemAccess, updateFileInfo, writeToFile } from './fileSystem';
import { initExportImport, exportText, exportJson, exportOpml, importJson } from './exportImport';
import { applySearch } from './search';
import { getCurrentRoot } from './nodeHelpers';
import { showToast } from './toast';
import { initCalendar, openCalendar } from './calendar';

// ============================================================
// 初期化（最初にstateをロードする）
// ============================================================

store.state = loadState();

// コールバック注入
initModel(writeToFile);
initEditor(render);
initHistory(render);
initSidebar(render, saveState);
initFileSystem(render, saveState);
initExportImport(render, saveState);
initCalendar(render);

// ============================================================
// イベントリスナー
// ============================================================

// カレンダー
document.getElementById('calendar-btn')!.addEventListener('click', openCalendar);

// メニュー
document.getElementById('menu-btn')!.addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('export-menu')!.classList.toggle('open');
});

document.addEventListener('click', () => {
  document.getElementById('export-menu')!.classList.remove('open');
});

// ノードコピー以外の通常テキストコピーが発生したら、ノードクリップボードをクリア
// （ノードコピー時は e.preventDefault() でこのイベントが発火しない）
document.addEventListener('copy', () => {
  store.clipboardNodes = null;
});

document.addEventListener('mouseup', () => {
  store.isDragging = false;
  store.dragAnchorId = null;
  document.body.classList.remove('node-drag-selecting');
});

document.getElementById('export-menu')!.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).dataset.action;
  if (!action) return;
  document.getElementById('export-menu')!.classList.remove('open');

  if (action === 'open-file') openFile();
  else if (action === 'save-file-as') saveFileAs();
  else if (action === 'export-text') exportText();
  else if (action === 'export-json') exportJson();
  else if (action === 'export-opml') exportOpml();
  else if (action === 'import-json') document.getElementById('file-import')!.click();
  else if (action === 'shortcuts') (document.getElementById('shortcuts-modal') as HTMLElement).style.display = '';
});

document.getElementById('file-import')!.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files![0];
  if (file) importJson(file);
  (e.target as HTMLInputElement).value = '';
});

// 検索
document.getElementById('search-box')!.addEventListener('input', (e) => {
  store.searchQuery = (e.target as HTMLInputElement).value;
  applySearch();
});

// ショートカットモーダル
function closeShortcuts(): void {
  (document.getElementById('shortcuts-modal') as HTMLElement).style.display = 'none';
}
document.getElementById('shortcuts-close')!.addEventListener('click', closeShortcuts);
document.getElementById('shortcuts-backdrop')!.addEventListener('click', closeShortcuts);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (document.getElementById('shortcuts-modal') as HTMLElement).style.display === '') {
    closeShortcuts();
  }
}, true);

// サイドバートグル
document.getElementById('sidebar-toggle')!.addEventListener('click', toggleSidebar);

// サイドバードロップゾーン
const sidebarDropZone = document.getElementById('sidebar-drop-zone')!;
sidebarDropZone.addEventListener('dragover', (e) => {
  if (!e.dataTransfer!.types.includes('node-id')) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
  sidebarDropZone.classList.add('drag-over');
});
sidebarDropZone.addEventListener('dragleave', (e) => {
  if (!sidebarDropZone.contains(e.relatedTarget as Node)) {
    sidebarDropZone.classList.remove('drag-over');
  }
});
sidebarDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  sidebarDropZone.classList.remove('drag-over');
  const nodeId = e.dataTransfer!.getData('node-id');
  if (!nodeId) return;
  if (store.state.pinnedItems.includes(nodeId)) {
    showToast('すでに登録済みです');
    return;
  }
  store.state.pinnedItems.push(nodeId);
  saveState();
  renderSidebar();
  showToast('お気に入りに追加しました');
});

// ページタイトル編集
const titleEl = document.getElementById('page-title')!;
titleEl.addEventListener('input', () => {
  store.state.title = titleEl.textContent!;
  scheduleTextHistory();
  saveState();
  renderBreadcrumb(getCurrentRoot());
});
titleEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    const firstText = document.querySelector('.node-text') as HTMLElement | null;
    if (firstText) firstText.focus();
  }
});

// グローバルキーボードショートカット
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '?') {
    e.preventDefault();
    (document.getElementById('shortcuts-modal') as HTMLElement).style.display = '';
    return;
  }
  if (e.key === 'Escape' && store.state.currentPath.length > 0) {
    store.state.currentPath.pop();
    render();
  }
});

// ============================================================
// 起動
// ============================================================

// File System Access API 非対応ブラウザでメニュー項目をグレーアウト
if (!hasFileSystemAccess) {
  document.querySelectorAll('[data-action="open-file"], [data-action="save-file-as"]').forEach(el => {
    el.classList.add('disabled');
    (el as HTMLElement).title = 'Chrome / Edge が必要です';
  });
}

updateFileInfo();
render();
renderSidebar();

if (store.state.root.children.length === 0) {
  store.state.root.children.push(createNode(''));
  render();
}

recordHistory();

import { store } from './store';
import { migrateState } from './model';
import { showToast } from './toast';

let _render: (() => void) | null = null;
let _saveState: (() => void) | null = null;

export function initExportImport(renderFn: () => void, saveStateFn: () => void): void {
  _render = renderFn;
  _saveState = saveStateFn;
}

export function exportText(): void {
  const lines: string[] = [];
  function walk(node: any, depth: number) {
    if (node === store.state.root) {
      lines.push(store.state.title || 'Bloomline');
    } else {
      const prefix = node.checked !== undefined
        ? (node.checked ? '[x] ' : '[ ] ')
        : '';
      lines.push('  '.repeat(depth) + '- ' + prefix + node.text);
      if (node.note) lines.push('  '.repeat(depth + 1) + node.note);
    }
    node.children.forEach((c: any) => walk(c, depth + (node === store.state.root ? 0 : 1)));
  }
  walk(store.state.root, 0);
  download('bloomline-export.txt', lines.join('\n'), 'text/plain');
}

export function exportJson(): void {
  download('bloomline-export.json', JSON.stringify(store.state, null, 2), 'application/json');
}

export function exportOpml(): void {
  function nodeToOpml(node: any, indent: number): string {
    const pad = '  '.repeat(indent);
    const text = escapeXml(node.text || '');
    const note = node.note ? ` _note="${escapeXml(node.note)}"` : '';
    if (node.children.length === 0) {
      return `${pad}<outline text="${text}"${note}/>`;
    }
    const children = node.children.map((c: any) => nodeToOpml(c, indent + 1)).join('\n');
    return `${pad}<outline text="${text}"${note}>\n${children}\n${pad}</outline>`;
  }

  const body = store.state.root.children.map(c => nodeToOpml(c, 2)).join('\n');
  const opml = `<?xml version="1.0" encoding="utf-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(store.state.title || 'Bloomline')}</title>
  </head>
  <body>
${body}
  </body>
</opml>`;
  download('bloomline-export.opml', opml, 'text/xml');
}

function escapeXml(s: string): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function download(filename: string, content: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importJson(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse((e.target as FileReader).result as string);
      if (!parsed.root) throw new Error('Invalid format');
      store.state = migrateState(parsed);
      _saveState?.();
      _render?.();
      showToast('インポート完了！');
    } catch (err: any) {
      showToast('インポートに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
}

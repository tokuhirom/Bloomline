# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド (dist/index.html に単一ファイル出力)
npm test             # テスト全件実行
npm run lint         # oxlint
npm run format       # oxfmt でフォーマット適用
npm run format:check # フォーマットチェックのみ（CI 用）
```

単一テストファイルを実行する場合:
```bash
npx vitest run src/__tests__/keyHandlers.test.ts
```

## アーキテクチャ

### データフロー

```
store.ts (グローバル状態)
  └─ state: AppState (root ノードツリー、currentPath、etc.)
  └─ UI 状態 (lastFocusId, selAnchorId, hideChecked, etc.)

main.ts → render() → renderNodes() → createNodeEl() (DOM 再構築)
                   → renderBreadcrumb()
                   → renderSidebar()
                   → saveState() → localStorage
```

`render()` は毎回 DOM を全再構築する単純なアプローチ。仮想 DOM なし。

### キー処理の構造

```
KeyboardEvent
  └─ resolveAction(e, isMac): ActionName | null   ← 純粋関数 (keyHandlers.ts)
       └─ handleKeyDown() in editor.ts            ← DOM 操作 + render() 呼び出し
```

`resolveAction` は DOM に依存しない純粋関数なのでユニットテスト可能。ActionName の追加は `keyHandlers.ts` の `ActionName` 型と `resolveAction` と `handleKeyDown` の switch の3箇所。

### ズーム（ドリルダウン）

`store.state.currentPath` が ID の配列で現在の表示階層を表す。`getCurrentRoot()` がこのパスを辿って現在の「ルート」ノードを返す。`render()` は History API (`pushState`/`replaceState`) と同期するため、ブラウザの戻る/進むボタンが機能する。

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `store.ts` | グローバル状態（シングルトン） |
| `types.ts` | `BloomlineNode`, `AppState` の型定義 |
| `model.ts` | `loadState`/`saveState`/`migrateState`、`createNode`、`uuid` |
| `keyHandlers.ts` | 全アクション関数 + `resolveAction` + `ActionName` 型 |
| `editor.ts` | `handleKeyDown`（`resolveAction` → switch ディスパッチ）、`handlePaste` |
| `render.ts` | `render()`、`createNodeEl()`、History API 同期、Move to モーダル |
| `flatSearch.ts` | Shift+Enter のフラット検索 UI ロジック |
| `search.ts` | 現在ビューの絞り込み (`applySearch`)、ハイライト |

### テスト対象

DOM 不要な純粋ロジックのみテスト対象:
- `keyHandlers.ts` — `resolveAction`, `moveNodeUp/Down`, `indentNode/outdentNode`, `removeNode`
- `nodeHelpers.ts` — ノードツリー操作
- `model.ts` — `migrateState`, `createNode`

テスト環境は `vitest` + `environment: 'node'`。`KeyboardEvent` が存在しないため `resolveAction` は `KeyEventLike` プレーンオブジェクトで受け取る設計。

## コーディング規約

- **フォーマット**: oxfmt（シングルクォート → ダブルクォート、trailing comma など）。`git commit` 時に pre-commit hook で自動実行される。
- **`render` の渡し方**: `keyHandlers.ts` の関数は `render` を引数で受け取る（モジュールレベル変数に依存しない）。
- **未使用パラメータ**: `_` プレフィックスを付ける（例: `_currentRoot`）。
- **catch パラメータ**: 使わない場合は `catch {}` を使う（`catch (e) {}` は oxlint 警告）。

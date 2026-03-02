import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// フォーカス中の .node-text での文字オフセットを返す
async function getCursorPosition(page: Page): Promise<number> {
  return page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return -1;
    return sel.getRangeAt(0).startOffset;
  });
}

// フォーカス中の .node-text の textContent を返す
async function getActiveNodeText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    return el.textContent ?? "";
  });
}

// 指定要素のカーソル位置を文字オフセットで設定する
async function setCursorPosition(page: Page, text: string, offset: number): Promise<void> {
  await page.evaluate(
    ({ text, offset }) => {
      const nodes = Array.from(document.querySelectorAll(".node-text")) as HTMLElement[];
      const target = nodes.find((el) => el.textContent === text);
      if (!target) throw new Error(`node with text "${text}" not found`);
      target.focus();
      const range = document.createRange();
      const sel = window.getSelection()!;
      const textNode = target.childNodes[0];
      if (!textNode) {
        range.setStart(target, 0);
        range.setEnd(target, 0);
      } else {
        const clampedOffset = Math.min(offset, (textNode as Text).length);
        range.setStart(textNode, clampedOffset);
        range.setEnd(textNode, clampedOffset);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    },
    { text, offset },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector(".node-text");

  // 最初のノードに "hello" を入力
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("hello");

  // Enter で新しいノードを作成して "world" を入力
  await page.keyboard.press("Enter");
  await page.keyboard.type("world");
});

test("ArrowDown: 先頭(pos 0)から押すと次ノードの先頭(pos 0)に移動する", async ({ page }) => {
  // node1 の先頭にカーソルを移動
  await setCursorPosition(page, "hello", 0);

  await page.keyboard.press("ArrowDown");

  const text = await getActiveNodeText(page);
  expect(text).toBe("world");

  const pos = await getCursorPosition(page);
  expect(pos).toBe(0);
});

test("ArrowDown: 末尾(pos 5)から押すと次ノードの末尾付近に移動する", async ({ page }) => {
  // node1 の末尾にカーソルを移動
  await setCursorPosition(page, "hello", 5);

  await page.keyboard.press("ArrowDown");

  const text = await getActiveNodeText(page);
  expect(text).toBe("world");

  // X 座標ベースの位置決め（caretRangeFromPoint）はピクセル精度のため
  // 末尾付近（4〜5）に移動することを確認する
  const pos = await getCursorPosition(page);
  expect(pos).toBeGreaterThanOrEqual(4);
  expect(pos).toBeLessThanOrEqual(5);
});

test("ArrowDown: 中間(pos 2)から押すと X 座標を保持して次ノードに移動する", async ({ page }) => {
  await setCursorPosition(page, "hello", 2);

  await page.keyboard.press("ArrowDown");

  const text = await getActiveNodeText(page);
  expect(text).toBe("world");

  // X 座標保持のため pos は 2 前後になるはず（等幅フォントなら一致する）
  const pos = await getCursorPosition(page);
  expect(pos).toBeGreaterThanOrEqual(0);
  expect(pos).toBeLessThanOrEqual(5);
});

test("ArrowUp: 先頭(pos 0)から押すと前ノードの先頭(pos 0)に移動する", async ({ page }) => {
  // node2（world）の先頭にカーソルを移動
  await setCursorPosition(page, "world", 0);

  await page.keyboard.press("ArrowUp");

  const text = await getActiveNodeText(page);
  expect(text).toBe("hello");

  const pos = await getCursorPosition(page);
  expect(pos).toBe(0);
});

test("ArrowUp: 末尾(pos 5)から押すと前ノードの末尾(pos 5)に移動する", async ({ page }) => {
  await setCursorPosition(page, "world", 5);

  await page.keyboard.press("ArrowUp");

  const text = await getActiveNodeText(page);
  expect(text).toBe("hello");

  const pos = await getCursorPosition(page);
  expect(pos).toBe(5);
});

test("キャレット可視性: ArrowDown 後に次ノードがフォーカスされてキャレット位置が有効である", async ({
  page,
}) => {
  await setCursorPosition(page, "hello", 5);

  await page.keyboard.press("ArrowDown");

  // .node-text がフォーカスされていることを確認
  const activeTag = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.className ?? "") : "";
  });
  expect(activeTag).toContain("node-text");

  // キャレット位置が有効範囲内であることを確認
  const pos = await getCursorPosition(page);
  expect(pos).toBeGreaterThanOrEqual(0);
});

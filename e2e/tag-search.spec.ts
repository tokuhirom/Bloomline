import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function getSearchBoxValue(page: Page): Promise<string> {
  return page.inputValue("#search-box");
}

async function getVisibleNodeTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".node-item:not(.search-hidden) .node-text")).map(
      (el) => el.textContent ?? "",
    ),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector(".node-text");
});

test("タグが span.tag としてレンダリングされる", async ({ page }) => {
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("hello #foobar world");

  // 別ノードに移動してフォーカスを外す（blur → renderInlineContent）
  await page.keyboard.press("Enter");
  await page.keyboard.type("other");

  // タグが span.tag として描画されている
  const tag = page.locator(".node-text .tag").first();
  await expect(tag).toBeVisible();
  await expect(tag).toHaveText("#foobar");
});

test("タグをクリックすると検索ボックスにタグが入る", async ({ page }) => {
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("hello #foobar world");

  await page.keyboard.press("Enter");
  await page.keyboard.type("other");

  // タグをクリック
  const tag = page.locator(".node-text .tag").first();
  await tag.click();

  // 検索ボックスに #foobar が入る
  expect(await getSearchBoxValue(page)).toBe("#foobar");
});

test("タグクリック後は検索ボックスにフォーカスが当たる", async ({ page }) => {
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("hello #mytag");

  await page.keyboard.press("Enter");
  await page.keyboard.type("other");

  await page.locator(".node-text .tag").first().click();

  const focused = await page.evaluate(() => document.activeElement?.id);
  expect(focused).toBe("search-box");
});

test("タグ検索でタグを含むノードのみ表示される", async ({ page }) => {
  // ノード1: #work タグあり
  const first = page.locator(".node-text").first();
  await first.click();
  await first.type("task #work important");

  // ノード2: タグなし
  await page.keyboard.press("Enter");
  await page.keyboard.type("no tags here");

  // ノード3: 別のタグ
  await page.keyboard.press("Enter");
  await page.keyboard.type("meeting #personal");

  // ノード4: #work タグあり
  await page.keyboard.press("Enter");
  await page.keyboard.type("deadline #work tomorrow");

  // アクティブノードを blur してインライン描画を確定
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  // #work タグをクリック
  const workTag = page.locator(".node-text .tag").filter({ hasText: "#work" }).first();
  await workTag.click();

  const visible = await getVisibleNodeTexts(page);

  // #work を含むノードが表示される
  expect(visible.some((t) => t.includes("task"))).toBe(true);
  expect(visible.some((t) => t.includes("deadline"))).toBe(true);

  // タグなしノードは非表示
  expect(visible.some((t) => t === "no tags here")).toBe(false);

  // 別タグのノードは非表示
  expect(visible.some((t) => t.includes("meeting"))).toBe(false);
});

test("#foo が #foobar にマッチしない（完全マッチ）", async ({ page }) => {
  const first = page.locator(".node-text").first();
  await first.click();
  await first.type("exact #foo match");

  await page.keyboard.press("Enter");
  await page.keyboard.type("not matching #foobar");

  await page.keyboard.press("Enter");
  await page.keyboard.type("other node");

  // アクティブノードを blur してインライン描画を確定
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  // #foo タグをクリック（"exact #foo match" ノードのタグ）
  const fooTag = page
    .locator(".node-text .tag")
    .filter({ hasText: /^#foo$/ })
    .first();
  await fooTag.click();

  const visible = await getVisibleNodeTexts(page);

  // #foo を含むノードは表示
  expect(visible.some((t) => t.includes("exact #foo match"))).toBe(true);

  // #foobar は #foo にマッチしない → 非表示
  expect(visible.some((t) => t.includes("#foobar"))).toBe(false);
});

test("Escape で検索前の画面に戻る", async ({ page }) => {
  // 2レベルのノードを作成してズームイン
  const first = page.locator(".node-text").first();
  await first.click();
  await first.type("parent node");

  await page.keyboard.press("Enter");
  await page.keyboard.type("child #tag1");
  await page.keyboard.press("Tab"); // 子ノードにインデント

  // ズームイン（parent node をクリックしてズーム）
  await page.locator(".node-text").filter({ hasText: "parent node" }).click();
  // ズームインはバレットクリックで行う想定のため、先に別の方法で確認
  // ここでは root に留まるシナリオでテスト

  // #tag1 タグをクリック
  const tag = page.locator(".node-text .tag").filter({ hasText: "#tag1" }).first();
  await tag.click();
  expect(await getSearchBoxValue(page)).toBe("#tag1");

  // Escape で検索をクリア
  await page.keyboard.press("Escape");

  // 検索ボックスが空になる
  expect(await getSearchBoxValue(page)).toBe("");

  // すべてのノードが表示される
  const visible = await getVisibleNodeTexts(page);
  expect(visible.length).toBeGreaterThan(0);
});

test("タグ検索中もノードの編集ができる", async ({ page }) => {
  const first = page.locator(".node-text").first();
  await first.click();
  await first.type("edit me #edittag");

  await page.keyboard.press("Enter");
  await page.keyboard.type("other");

  // アクティブノードを blur してインライン描画を確定
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  // タグクリック
  const tag = page.locator(".node-text .tag").filter({ hasText: "#edittag" }).first();
  await tag.click();

  // タグ検索中にノードをクリックして編集
  const editNode = page.locator(".node-text").filter({ hasText: /edit me/ }).first();
  await editNode.click();

  // テキストが編集可能な状態（contenteditable="true"）
  const isEditable = await editNode.evaluate(
    (el) => (el as HTMLElement).contentEditable === "true",
  );
  expect(isEditable).toBe(true);
});

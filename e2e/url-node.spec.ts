import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function getNodeTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".node-text")).map((el) => el.textContent ?? ""),
  );
}

// フォーカス中のノードの data-id を返す
async function getFocusedNodeId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement?.closest("[data-id]") as HTMLElement | null;
    return el?.dataset.id ?? null;
  });
}

// 指定テキストのノードの data-id を返す
async function getNodeId(page: Page, text: string): Promise<string | null> {
  return page.evaluate((text) => {
    const nodes = Array.from(document.querySelectorAll(".node-text"));
    const el = nodes.find((n) => n.textContent === text);
    return (el?.closest("[data-id]") as HTMLElement | null)?.dataset.id ?? null;
  }, text);
}

// 指定ノードが別ノードの子かどうか確認
async function isChildOf(
  page: Page,
  childId: string,
  parentId: string,
): Promise<boolean> {
  return page.evaluate(
    ({ childId, parentId }) => {
      const child = document.querySelector(`[data-id="${childId}"]`);
      const parent = document.querySelector(`[data-id="${parentId}"]`);
      return parent !== null && child !== null && parent.contains(child) && parent !== child;
    },
    { childId, parentId },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector(".node-text");
});

test("URL ノードの下のノードで Tab を押すと URL ノードの子にインデントされる", async ({
  page,
}) => {
  // 1つ目のノードに URL を入力
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("https://example.com");

  // Enter で新しいノードを作成して "below" を入力
  await page.keyboard.press("Enter");
  await page.keyboard.type("below");

  // URL ノードと below ノードが同じ階層にある
  const urlNodeId = await getNodeId(page, "https://example.com");
  const belowNodeId = await getNodeId(page, "below");
  expect(urlNodeId).not.toBeNull();
  expect(belowNodeId).not.toBeNull();

  // "below" ノードにフォーカスがある状態で Tab を押す
  const belowEl = page.locator(".node-text").filter({ hasText: /^below$/ });
  await belowEl.click();
  await page.keyboard.press("Tab");

  // "below" ノードが URL ノードの子になっているはず
  const isChild = await isChildOf(page, belowNodeId!, urlNodeId!);
  expect(isChild).toBe(true);
});

test("URL ノード自体にフォーカスして Tab を押すとインデントされる", async ({ page }) => {
  // ノード1: 通常テキスト（URL ノードの前の兄弟になる）
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("sibling");

  // ノード2: URL ノード
  await page.keyboard.press("Enter");
  await page.keyboard.type("https://example.com");

  // URL ノードにフォーカスを移動（ArrowDown）
  await page.keyboard.press("ArrowDown");

  // 現在フォーカスが URL ノードにあるか確認
  const focusedId = await getFocusedNodeId(page);
  const urlNodeId = await getNodeId(page, "https://example.com");
  expect(focusedId).toBe(urlNodeId);

  const siblingId = await getNodeId(page, "sibling");

  // Tab でインデント（sibling の子になるはず）
  await page.keyboard.press("Tab");

  // URL ノードが sibling の子になっているはず
  const isChild = await isChildOf(page, urlNodeId!, siblingId!);
  expect(isChild).toBe(true);
});

test("ArrowDown で URL ノードの下のノードに移動後、Tab でインデントされる", async ({ page }) => {
  // ノード1: 通常テキスト
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("first");

  // ノード2: URL ノード
  await page.keyboard.press("Enter");
  await page.keyboard.type("https://example.com");

  // ノード3: URL ノードの下の通常ノード
  await page.keyboard.press("Enter");
  await page.keyboard.type("third");

  const urlNodeId = await page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".node-text"));
      const el = nodes.find((n) => n.textContent === "https://example.com");
      return (el?.closest("[data-id]") as HTMLElement | null)?.dataset.id ?? null;
    });
  const thirdNodeId = await page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".node-text"));
      const el = nodes.find((n) => n.textContent === "third");
      return (el?.closest("[data-id]") as HTMLElement | null)?.dataset.id ?? null;
    });

  // first ノードをクリックして ArrowDown x2 で third ノードへ移動
  const firstEl = page.locator(".node-text").filter({ hasText: /^first$/ });
  await firstEl.click();
  await page.keyboard.press("ArrowDown"); // → URL ノード
  await page.keyboard.press("ArrowDown"); // → third ノード

  // フォーカスが third ノードにある
  const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(focusedText).toBe("third");

  // Tab でインデント
  await page.keyboard.press("Tab");

  // third ノードが URL ノードの子になっているはず
  const isChild = await page.evaluate(
    ({ childId, parentId }) => {
      const child = document.querySelector(`[data-id="${childId}"]`);
      const parent = document.querySelector(`[data-id="${parentId}"]`);
      return parent !== null && child !== null && parent.contains(child) && parent !== child;
    },
    { childId: thirdNodeId, parentId: urlNodeId },
  );
  expect(isChild).toBe(true);
});

test("ArrowDown で URL ノードを通過してその下のノードに移動できる", async ({ page }) => {
  // ノード1: 通常テキスト
  const firstNode = page.locator(".node-text").first();
  await firstNode.click();
  await firstNode.type("first");

  // ノード2: URL ノード
  await page.keyboard.press("Enter");
  await page.keyboard.type("https://example.com");

  // ノード3: URL ノードの下の通常ノード
  await page.keyboard.press("Enter");
  await page.keyboard.type("third");

  // first ノードから ArrowDown x2 で third ノードへ
  const firstEl = page.locator(".node-text").filter({ hasText: /^first$/ });
  await firstEl.click();
  await page.keyboard.press("ArrowDown"); // → URL ノード
  await page.keyboard.press("ArrowDown"); // → third ノード

  const activeText = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(activeText).toBe("third");
});

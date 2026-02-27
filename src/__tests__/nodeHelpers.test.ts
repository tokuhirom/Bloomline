import { describe, it, expect, beforeEach } from "vitest";
import { store } from "../store";
import { createNode } from "../model";
import {
  findNode,
  moveNode,
  isDescendantOrSelf,
  cloneNode,
  flatVisibleNodes,
  getPathToNode,
} from "../nodeHelpers";
import type { BloomlineNode } from "../types";

function makeRoot(...children: BloomlineNode[]): BloomlineNode {
  const root = createNode("root");
  root.children = children;
  return root;
}

beforeEach(() => {
  // store.state を最小限のダミーでセットアップ
  const root = createNode("root");
  store.state = { root, currentPath: [], title: "Test", pinnedItems: [], version: 1 };
});

describe("findNode", () => {
  it("ルートノード自身を見つける", () => {
    const root = createNode("root");
    const res = findNode(root.id, root);
    expect(res).not.toBeNull();
    expect(res!.node.id).toBe(root.id);
    expect(res!.parent).toBeNull();
  });

  it("直接の子ノードを見つける", () => {
    const child = createNode("child");
    const root = makeRoot(child);
    const res = findNode(child.id, root);
    expect(res).not.toBeNull();
    expect(res!.node.id).toBe(child.id);
    expect(res!.parent!.id).toBe(root.id);
    expect(res!.index).toBe(0);
  });

  it("深くネストしたノードを見つける", () => {
    const grandchild = createNode("grandchild");
    const child = createNode("child");
    child.children = [grandchild];
    const root = makeRoot(child);
    const res = findNode(grandchild.id, root);
    expect(res).not.toBeNull();
    expect(res!.node.id).toBe(grandchild.id);
    expect(res!.parent!.id).toBe(child.id);
    expect(res!.index).toBe(0);
  });

  it("存在しないIDはnullを返す", () => {
    const root = createNode("root");
    const res = findNode("nonexistent", root);
    expect(res).toBeNull();
  });
});

describe("moveNode", () => {
  it("before 位置に移動できる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNode(b.id, a.id, "before", root);

    expect(root.children[0].id).toBe(b.id);
    expect(root.children[1].id).toBe(a.id);
  });

  it("after 位置に移動できる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");
    const root = makeRoot(a, b, c);

    moveNode(a.id, b.id, "after", root);

    expect(root.children[0].id).toBe(b.id);
    expect(root.children[1].id).toBe(a.id);
    expect(root.children[2].id).toBe(c.id);
  });

  it("child 位置に移動できる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNode(b.id, a.id, "child", root);

    expect(root.children.length).toBe(1);
    expect(root.children[0].id).toBe(a.id);
    expect(root.children[0].children[0].id).toBe(b.id);
  });

  it("collapsed なノードに child として移動すると collapsed が解除される", () => {
    const a = createNode("a");
    a.collapsed = true;
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNode(b.id, a.id, "child", root);

    expect(a.collapsed).toBe(false);
  });

  it("存在しない src ID は何もしない", () => {
    const a = createNode("a");
    const root = makeRoot(a);

    moveNode("nonexistent", a.id, "before", root);

    expect(root.children.length).toBe(1);
    expect(root.children[0].id).toBe(a.id);
  });
});

describe("isDescendantOrSelf", () => {
  it("自己参照は true を返す", () => {
    const a = createNode("a");
    const root = makeRoot(a);
    expect(isDescendantOrSelf(a.id, a.id, root)).toBe(true);
  });

  it("直接の子孫は true を返す", () => {
    const child = createNode("child");
    const parent = createNode("parent");
    parent.children = [child];
    const root = makeRoot(parent);
    expect(isDescendantOrSelf(parent.id, child.id, root)).toBe(true);
  });

  it("無関係ノードは false を返す", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);
    expect(isDescendantOrSelf(a.id, b.id, root)).toBe(false);
  });

  it("存在しない src は false を返す", () => {
    const root = createNode("root");
    expect(isDescendantOrSelf("nonexistent", root.id, root)).toBe(false);
  });
});

describe("cloneNode", () => {
  it("IDが変わる", () => {
    const node = createNode("test");
    const cloned = cloneNode(node);
    expect(cloned.id).not.toBe(node.id);
  });

  it("テキストが正しくコピーされる", () => {
    const node = createNode("hello");
    const cloned = cloneNode(node);
    expect(cloned.text).toBe("hello");
  });

  it("子孫も全てコピーされIDが変わる", () => {
    const child = createNode("child");
    const node = createNode("parent");
    node.children = [child];
    const cloned = cloneNode(node);
    expect(cloned.children.length).toBe(1);
    expect(cloned.children[0].id).not.toBe(child.id);
    expect(cloned.children[0].text).toBe("child");
  });
});

describe("flatVisibleNodes", () => {
  it("通常のノードは全て含まれる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const child = createNode("child");
    a.children = [child];
    const root = makeRoot(a, b);
    const nodes = flatVisibleNodes(root);
    expect(nodes.map((n) => n.id)).toEqual([a.id, child.id, b.id]);
  });

  it("collapsed ノードの子は除外される", () => {
    const a = createNode("a");
    a.collapsed = true;
    const child = createNode("child");
    a.children = [child];
    const b = createNode("b");
    const root = makeRoot(a, b);
    const nodes = flatVisibleNodes(root);
    expect(nodes.map((n) => n.id)).toEqual([a.id, b.id]);
  });

  it("ルートノード自身は含まれない", () => {
    const a = createNode("a");
    const root = makeRoot(a);
    const nodes = flatVisibleNodes(root);
    expect(nodes.some((n) => n.id === root.id)).toBe(false);
  });
});

describe("getPathToNode", () => {
  it("直接の子ノードへのパスを返す", () => {
    const child = createNode("child");
    const root = makeRoot(child);
    const path = getPathToNode(child.id, root);
    expect(path).toEqual([child.id]);
  });

  it("孫ノードへのパスを返す", () => {
    const grandchild = createNode("grandchild");
    const child = createNode("child");
    child.children = [grandchild];
    const root = makeRoot(child);
    const path = getPathToNode(grandchild.id, root);
    expect(path).toEqual([child.id, grandchild.id]);
  });

  it("存在しないノードは null を返す", () => {
    const root = createNode("root");
    const path = getPathToNode("nonexistent", root);
    expect(path).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAction,
  moveNodeUp,
  moveNodeDown,
  indentNode,
  outdentNode,
  removeNode,
  type KeyEventLike,
} from "../keyHandlers";
import { store } from "../store";
import { createNode } from "../model";
import type { BloomlineNode } from "../types";

function makeRoot(...children: BloomlineNode[]): BloomlineNode {
  const root = createNode("root");
  root.children = children;
  return root;
}

beforeEach(() => {
  const root = createNode("root");
  store.state = { root, currentPath: [], title: "Test", pinnedItems: [], version: 1 };
});

const noop = () => {};

// ===== resolveAction =====

describe("resolveAction", () => {
  function key(init: KeyEventLike): KeyEventLike {
    return init;
  }

  describe("ArrowUp/Down の優先順位", () => {
    it("⇧⌘↑ → moveNodeUp（catch-all ↑ より先に解決される）", () => {
      expect(resolveAction(key({ key: "ArrowUp", shiftKey: true, metaKey: true }), true)).toBe(
        "moveNodeUp",
      );
    });

    it("⇧⌥↑ → moveNodeUp", () => {
      expect(resolveAction(key({ key: "ArrowUp", shiftKey: true, altKey: true }), true)).toBe(
        "moveNodeUp",
      );
    });

    it("⇧↑（meta/alt なし）→ expandSelectionUp", () => {
      expect(resolveAction(key({ key: "ArrowUp", shiftKey: true }), true)).toBe(
        "expandSelectionUp",
      );
    });

    it("Ctrl+↑ → collapseNode", () => {
      expect(resolveAction(key({ key: "ArrowUp", ctrlKey: true }), true)).toBe("collapseNode");
    });

    it("↑（修飾キーなし）→ focusPrev", () => {
      expect(resolveAction(key({ key: "ArrowUp" }), true)).toBe("focusPrev");
    });

    it("⇧⌘↓ → moveNodeDown（catch-all ↓ より先に解決される）", () => {
      expect(resolveAction(key({ key: "ArrowDown", shiftKey: true, metaKey: true }), true)).toBe(
        "moveNodeDown",
      );
    });

    it("⇧↓（meta/alt なし）→ expandSelectionDown", () => {
      expect(resolveAction(key({ key: "ArrowDown", shiftKey: true }), true)).toBe(
        "expandSelectionDown",
      );
    });

    it("Ctrl+↓ → expandNode", () => {
      expect(resolveAction(key({ key: "ArrowDown", ctrlKey: true }), true)).toBe("expandNode");
    });

    it("↓（修飾キーなし）→ focusNext", () => {
      expect(resolveAction(key({ key: "ArrowDown" }), true)).toBe("focusNext");
    });
  });

  describe("Backspace の優先順位", () => {
    it("Cmd+Shift+BS → deleteNode（catch-all backspace より先に解決される）", () => {
      expect(resolveAction(key({ key: "Backspace", metaKey: true, shiftKey: true }), true)).toBe(
        "deleteNode",
      );
    });

    it("Ctrl+Shift+BS → deleteNode", () => {
      expect(resolveAction(key({ key: "Backspace", ctrlKey: true, shiftKey: true }), true)).toBe(
        "deleteNode",
      );
    });

    it("Backspace（修飾キーなし）→ backspace", () => {
      expect(resolveAction(key({ key: "Backspace" }), true)).toBe("backspace");
    });
  });

  describe("Enter バリアント", () => {
    it("Cmd+Enter → toggleChecked", () => {
      expect(resolveAction(key({ key: "Enter", metaKey: true }), true)).toBe("toggleChecked");
    });

    it("Shift+Enter → openNote", () => {
      expect(resolveAction(key({ key: "Enter", shiftKey: true }), true)).toBe("openNote");
    });

    it("Enter → splitNode", () => {
      expect(resolveAction(key({ key: "Enter" }), true)).toBe("splitNode");
    });
  });

  describe("IME 変換中は Enter を無視", () => {
    it("isComposing=true の Enter → null", () => {
      expect(resolveAction(key({ key: "Enter", isComposing: true }), true)).toBeNull();
    });

    it("isComposing=true の Cmd+Enter → null", () => {
      expect(
        resolveAction(key({ key: "Enter", metaKey: true, isComposing: true }), true),
      ).toBeNull();
    });
  });

  describe("Mac Emacs バインディング", () => {
    it("Mac: Ctrl+b → emacsBackward", () => {
      expect(resolveAction(key({ key: "b", ctrlKey: true }), true)).toBe("emacsBackward");
    });

    it("Mac: Ctrl+f → emacsForward（検索ショートカットと競合しない）", () => {
      expect(resolveAction(key({ key: "f", ctrlKey: true }), true)).toBe("emacsForward");
    });

    it("Mac: Cmd+f → null（グローバルハンドラに任せる）", () => {
      expect(resolveAction(key({ key: "f", metaKey: true }), true)).toBeNull();
    });

    it("非 Mac: Ctrl+f → null（グローバルハンドラに任せる）", () => {
      expect(resolveAction(key({ key: "f", ctrlKey: true }), false)).toBeNull();
    });

    it("Mac: Ctrl+k → emacsDeleteToEol", () => {
      expect(resolveAction(key({ key: "k", ctrlKey: true }), true)).toBe("emacsDeleteToEol");
    });

    it("非 Mac: Ctrl+b は Emacs ではなく wrapBold", () => {
      expect(resolveAction(key({ key: "b", ctrlKey: true }), false)).toBe("wrapBold");
    });
  });

  describe("ArrowRight/Left", () => {
    it("⌘→ → collapseParent", () => {
      expect(resolveAction(key({ key: "ArrowRight", metaKey: true }), true)).toBe("collapseParent");
    });

    it("⌥→ → zoomIn", () => {
      expect(resolveAction(key({ key: "ArrowRight", altKey: true }), true)).toBe("zoomIn");
    });

    it("⌥⇧→ → indentNodeAlt（⌥→ より先）", () => {
      expect(resolveAction(key({ key: "ArrowRight", altKey: true, shiftKey: true }), true)).toBe(
        "indentNodeAlt",
      );
    });

    it("⌥← → zoomOut", () => {
      expect(resolveAction(key({ key: "ArrowLeft", altKey: true }), true)).toBe("zoomOut");
    });

    it("⌥⇧← → outdentNodeAlt（⌥← より先）", () => {
      expect(resolveAction(key({ key: "ArrowLeft", altKey: true, shiftKey: true }), true)).toBe(
        "outdentNodeAlt",
      );
    });
  });

  describe("無関係なキー", () => {
    it("単純な文字入力は null", () => {
      expect(resolveAction(key({ key: "a" }), true)).toBeNull();
    });

    it("F1 は null", () => {
      expect(resolveAction(key({ key: "F1" }), true)).toBeNull();
    });
  });
});

// ===== moveNodeUp / moveNodeDown =====

describe("moveNodeUp", () => {
  it("ノードが1つ上に移動する", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNodeUp(b, root, noop);

    expect(root.children[0].id).toBe(b.id);
    expect(root.children[1].id).toBe(a.id);
  });

  it("先頭ノードは移動しない", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNodeUp(a, root, noop);

    expect(root.children[0].id).toBe(a.id);
  });

  it("移動後に render が呼ばれる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);
    const render = vi.fn();

    moveNodeUp(b, root, render);

    expect(render).toHaveBeenCalledOnce();
  });

  it("先頭ノードでは render が呼ばれない", () => {
    const a = createNode("a");
    const root = makeRoot(a);
    const render = vi.fn();

    moveNodeUp(a, root, render);

    expect(render).not.toHaveBeenCalled();
  });
});

describe("moveNodeDown", () => {
  it("ノードが1つ下に移動する", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNodeDown(a, root, noop);

    expect(root.children[0].id).toBe(b.id);
    expect(root.children[1].id).toBe(a.id);
  });

  it("末尾ノードは移動しない", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    moveNodeDown(b, root, noop);

    expect(root.children[1].id).toBe(b.id);
  });

  it("移動後に render が呼ばれる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);
    const render = vi.fn();

    moveNodeDown(a, root, render);

    expect(render).toHaveBeenCalledOnce();
  });
});

// ===== indentNode / outdentNode =====

describe("indentNode", () => {
  it("前の兄弟ノードの子になる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    indentNode(b, root, noop);

    expect(root.children.length).toBe(1);
    expect(root.children[0].id).toBe(a.id);
    expect(root.children[0].children[0].id).toBe(b.id);
  });

  it("先頭ノードは indent されない", () => {
    const a = createNode("a");
    const root = makeRoot(a);

    indentNode(a, root, noop);

    expect(root.children.length).toBe(1);
    expect(root.children[0].id).toBe(a.id);
  });

  it("collapsed な前の兄弟は展開される", () => {
    const a = createNode("a");
    a.collapsed = true;
    const b = createNode("b");
    const root = makeRoot(a, b);

    indentNode(b, root, noop);

    expect(a.collapsed).toBe(false);
  });

  it("skipRender=true の場合 render が呼ばれない", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);
    const render = vi.fn();

    indentNode(b, root, render, true);

    expect(render).not.toHaveBeenCalled();
  });
});

describe("outdentNode", () => {
  it("親の兄弟ノードになる", () => {
    const child = createNode("child");
    const parent = createNode("parent");
    parent.children = [child];
    const root = makeRoot(parent);

    outdentNode(child, root, noop);

    expect(root.children.length).toBe(2);
    expect(root.children[0].id).toBe(parent.id);
    expect(root.children[1].id).toBe(child.id);
  });

  it("ルート直下のノードは outdent されない", () => {
    const a = createNode("a");
    const root = makeRoot(a);

    outdentNode(a, root, noop);

    expect(root.children.length).toBe(1);
  });

  it("後続の兄弟が子になる", () => {
    const child1 = createNode("child1");
    const child2 = createNode("child2");
    const parent = createNode("parent");
    parent.children = [child1, child2];
    const root = makeRoot(parent);

    outdentNode(child1, root, noop);

    // child1 が root 直下に出てきて、child2 が child1 の子になる
    expect(root.children[1].id).toBe(child1.id);
    expect(child1.children[0].id).toBe(child2.id);
  });
});

// ===== removeNode =====

describe("removeNode", () => {
  it("ノードが削除される", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    removeNode(a, root, noop);

    expect(root.children.length).toBe(1);
    expect(root.children[0].id).toBe(b.id);
  });

  it("最後の1つは削除されない", () => {
    const a = createNode("a");
    const root = makeRoot(a);

    removeNode(a, root, noop);

    expect(root.children.length).toBe(1);
  });

  it("削除後に render が呼ばれる", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);
    const render = vi.fn();

    removeNode(a, root, render);

    expect(render).toHaveBeenCalledOnce();
  });

  it("最後の1つの場合は render が呼ばれない", () => {
    const a = createNode("a");
    const root = makeRoot(a);
    const render = vi.fn();

    removeNode(a, root, render);

    expect(render).not.toHaveBeenCalled();
  });

  it("削除後に前のノードにフォーカスが移る", () => {
    const a = createNode("a");
    const b = createNode("b");
    const root = makeRoot(a, b);

    removeNode(b, root, noop);

    expect(store.lastFocusId).toBe(a.id);
  });
});

import { describe, it, expect } from "vitest";
import { createNode, migrateState } from "../model";

describe("createNode", () => {
  it("デフォルト値でノードが作られる", () => {
    const node = createNode();
    expect(node.id).toBeTruthy();
    expect(node.text).toBe("");
    expect(node.note).toBe("");
    expect(node.children).toEqual([]);
    expect(node.collapsed).toBe(false);
    expect(node.checked).toBeUndefined();
  });

  it("テキストを指定できる", () => {
    const node = createNode("hello");
    expect(node.text).toBe("hello");
  });

  it("checked を指定できる", () => {
    const node = createNode("task", false);
    expect(node.checked).toBe(false);

    const checked = createNode("done", true);
    expect(checked.checked).toBe(true);
  });

  it("各ノードのIDはユニーク", () => {
    const a = createNode();
    const b = createNode();
    expect(a.id).not.toBe(b.id);
  });
});

describe("migrateState", () => {
  it("currentPath が欠落している場合に補完される", () => {
    const root = createNode("root");
    const raw: any = { root };
    const state = migrateState(raw);
    expect(state.currentPath).toEqual([]);
  });

  it("title が欠落している場合に補完される", () => {
    const root = createNode("root");
    const raw: any = { root };
    const state = migrateState(raw);
    expect(state.title).toBe("Bloomline");
  });

  it("pinnedItems が欠落している場合に補完される", () => {
    const root = createNode("root");
    const raw: any = { root };
    const state = migrateState(raw);
    expect(state.pinnedItems).toEqual([]);
  });

  it("version が欠落している場合に補完される", () => {
    const root = createNode("root");
    const raw: any = { root };
    const state = migrateState(raw);
    expect(state.version).toBe(1);
  });

  it("ノードに id が欠落している場合に補完される", () => {
    const raw: any = {
      root: { text: "root", children: [] },
    };
    const state = migrateState(raw);
    expect(state.root.id).toBeTruthy();
  });

  it("ノードに note が欠落している場合に補完される", () => {
    const raw: any = {
      root: { id: "r1", text: "root", children: [] },
    };
    const state = migrateState(raw);
    expect(state.root.note).toBe("");
  });

  it("子ノードのフィールドも補完される", () => {
    const raw: any = {
      root: {
        id: "r1",
        text: "root",
        children: [{ text: "child" }],
      },
    };
    const state = migrateState(raw);
    expect(state.root.children[0].id).toBeTruthy();
    expect(state.root.children[0].note).toBe("");
    expect(state.root.children[0].collapsed).toBe(false);
  });
});

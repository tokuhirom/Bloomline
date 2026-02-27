import { describe, it, expect } from "vitest";
import { isTopLine, isBottomLine } from "../cursor";

// isTopLine / isBottomLine は DOM に依存しない純粋関数なので node 環境でテスト可能

describe("isTopLine", () => {
  it("同じ高さならば true", () => {
    expect(isTopLine(100, 100)).toBe(true);
  });

  it("4px 差は閾値 5 未満なので true", () => {
    expect(isTopLine(100, 96)).toBe(true);
    expect(isTopLine(96, 100)).toBe(true);
  });

  it("5px 差はちょうど閾値なので false（< threshold）", () => {
    expect(isTopLine(100, 95)).toBe(false);
    expect(isTopLine(95, 100)).toBe(false);
  });

  it("20px 下の行にいる → false", () => {
    expect(isTopLine(120, 100)).toBe(false);
  });

  it("カスタム閾値を使える", () => {
    expect(isTopLine(100, 92, 10)).toBe(true);
    expect(isTopLine(100, 89, 10)).toBe(false);
  });
});

describe("isBottomLine", () => {
  it("同じ高さならば true", () => {
    expect(isBottomLine(200, 200)).toBe(true);
  });

  it("4px 差は閾値 5 未満なので true", () => {
    expect(isBottomLine(200, 196)).toBe(true);
    expect(isBottomLine(196, 200)).toBe(true);
  });

  it("5px 差はちょうど閾値なので false", () => {
    expect(isBottomLine(200, 195)).toBe(false);
    expect(isBottomLine(195, 200)).toBe(false);
  });

  it("最終行より上にいる → false", () => {
    expect(isBottomLine(180, 200)).toBe(false);
  });

  it("カスタム閾値を使える", () => {
    expect(isBottomLine(200, 192, 10)).toBe(true);
    expect(isBottomLine(200, 189, 10)).toBe(false);
  });
});

// isTopLine + isBottomLine の組み合わせで1行要素の挙動を確認
describe("1行要素のシミュレーション", () => {
  it("1行要素ではカーソル top = 要素 top = 要素 bottom → 両方 true", () => {
    const lineTop = 100;
    expect(isTopLine(lineTop, lineTop)).toBe(true);
    expect(isBottomLine(lineTop, lineTop)).toBe(true);
  });
});

// 複数行要素のシミュレーション（line-height 20px の 3 行要素）
describe("3行要素のシミュレーション（line-height=20px）", () => {
  const firstLineTop = 100;
  const secondLineTop = 120;
  const thirdLineTop = 140;

  it("1行目 → isTopLine=true, isBottomLine=false", () => {
    expect(isTopLine(firstLineTop, firstLineTop)).toBe(true);
    expect(isBottomLine(firstLineTop, thirdLineTop)).toBe(false);
  });

  it("2行目 → isTopLine=false, isBottomLine=false", () => {
    expect(isTopLine(secondLineTop, firstLineTop)).toBe(false);
    expect(isBottomLine(secondLineTop, thirdLineTop)).toBe(false);
  });

  it("3行目 → isTopLine=false, isBottomLine=true", () => {
    expect(isTopLine(thirdLineTop, firstLineTop)).toBe(false);
    expect(isBottomLine(thirdLineTop, thirdLineTop)).toBe(true);
  });
});

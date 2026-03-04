import { describe, it, expect } from "vitest";
import { isTagQuery, matchesQuery, highlightText } from "../search";

describe("isTagQuery", () => {
  it("#foobar → true", () => expect(isTagQuery("#foobar")).toBe(true));
  it("#foo-bar → true", () => expect(isTagQuery("#foo-bar")).toBe(true));
  it("#foo_bar → true", () => expect(isTagQuery("#foo_bar")).toBe(true));
  it("#foo123 → true", () => expect(isTagQuery("#foo123")).toBe(true));
  it("#F → true（1文字）", () => expect(isTagQuery("#F")).toBe(true));
  it("# だけ → false", () => expect(isTagQuery("#")).toBe(false));
  it("#foo bar → false（スペースあり）", () => expect(isTagQuery("#foo bar")).toBe(false));
  it("foo → false（# なし）", () => expect(isTagQuery("foo")).toBe(false));
  it("#foo.bar → false（. は不可）", () => expect(isTagQuery("#foo.bar")).toBe(false));
});

describe("matchesQuery - タグ検索（完全マッチ）", () => {
  it("#foo が 'text #foo end' にマッチする", () => {
    expect(matchesQuery("text #foo end", "#foo")).toBe(true);
  });

  it("#foo が '#foo' にマッチする（テキスト全体がタグ）", () => {
    expect(matchesQuery("#foo", "#foo")).toBe(true);
  });

  it("#foo が '#foobar' にマッチしない（前方一致は不可）", () => {
    expect(matchesQuery("#foobar", "#foo")).toBe(false);
  });

  it("#foo が 'prefix#foo' にマッチしない（直前に英数字）", () => {
    expect(matchesQuery("prefix#foo", "#foo")).toBe(false);
  });

  it("#foo が '#foo-bar' にマッチしない（直後に -）", () => {
    expect(matchesQuery("#foo-bar", "#foo")).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    expect(matchesQuery("text #FOO end", "#foo")).toBe(true);
    expect(matchesQuery("text #foo end", "#FOO")).toBe(true);
  });

  it("複数タグがあるテキストで正しいタグのみマッチ", () => {
    expect(matchesQuery("#bar #foo #baz", "#foo")).toBe(true);
    expect(matchesQuery("#bar #foo #baz", "#qux")).toBe(false);
  });

  it("句読点の直前・直後はマッチする", () => {
    expect(matchesQuery("text #foo.", "#foo")).toBe(true);
    expect(matchesQuery("text #foo,", "#foo")).toBe(true);
    expect(matchesQuery("(#foo)", "#foo")).toBe(true);
  });
});

describe("matchesQuery - 通常検索", () => {
  it("サブストリングマッチ", () => {
    expect(matchesQuery("hello world", "world")).toBe(true);
    expect(matchesQuery("hello world", "xyz")).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    expect(matchesQuery("Hello World", "hello")).toBe(true);
  });
});

describe("highlightText - タグハイライト", () => {
  it("#foo だけマッチした箇所を mark で囲む", () => {
    expect(highlightText("text #foo end", "#foo")).toBe("text <mark>#foo</mark> end");
  });

  it("#foo が #foobar を部分マッチしない", () => {
    const result = highlightText("#foobar", "#foo");
    expect(result).not.toContain("<mark>");
  });

  it("大文字小文字を区別せずハイライト", () => {
    expect(highlightText("text #FOO end", "#foo")).toContain("<mark>#FOO</mark>");
  });

  it("複数マッチ", () => {
    const result = highlightText("#foo text #foo", "#foo");
    const matches = result.match(/<mark>/g);
    expect(matches?.length).toBe(2);
  });
});

describe("highlightText - 通常ハイライト", () => {
  it("サブストリングをハイライト", () => {
    expect(highlightText("hello world", "world")).toContain("<mark>world</mark>");
  });

  it("HTML エスケープ", () => {
    expect(highlightText("<script>", "script")).toBe("&lt;<mark>script</mark>&gt;");
  });
});

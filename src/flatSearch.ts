import { store } from "./store";
import type { BloomlineNode } from "./types";
import { highlightText, escapeHtml, applySearch } from "./search";

interface MatchResult {
  node: BloomlineNode;
  ancestors: BloomlineNode[];
}

interface Group {
  ancestorIds: string[];
  headerHtml: string;
  matches: BloomlineNode[];
}

let panelEl: HTMLDivElement | null = null;
let flatItems: { node: BloomlineNode; ancestorIds: string[] }[] = [];
let selectedIndex = -1;
let _renderFn: (() => void) | null = null;
let _outsideClickHandler: ((e: MouseEvent) => void) | null = null;

export function initFlatSearch(renderFn: () => void): void {
  _renderFn = renderFn;
}

export function isFlatSearchOpen(): boolean {
  return panelEl !== null;
}

function truncateSegment(s: string, maxLen = 12): string {
  if (!s) return "(無題)";
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function buildBreadcrumbHtml(ancestors: BloomlineNode[]): string {
  const segments = ["Home", ...ancestors.map((a) => escapeHtml(truncateSegment(a.text)))];
  return segments
    .map((seg, i) => `<span class="fsp-crumb${i === 0 ? " fsp-crumb-home" : ""}">${seg}</span>`)
    .join('<span class="fsp-sep"> › </span>');
}

function collectMatches(query: string): MatchResult[] {
  const q = query.toLowerCase();
  const root = store.state.root;
  const results: MatchResult[] = [];

  function traverse(node: BloomlineNode, ancestors: BloomlineNode[]): void {
    if (node.text.toLowerCase().includes(q) || (node.note && node.note.toLowerCase().includes(q))) {
      results.push({ node, ancestors: [...ancestors] });
    }
    node.children.forEach((child) => traverse(child, [...ancestors, node]));
  }

  root.children.forEach((child) => traverse(child, []));
  return results;
}

function groupResults(matches: MatchResult[]): Group[] {
  const groupMap = new Map<string, Group>();
  const groupOrder: string[] = [];

  for (const m of matches) {
    const parent = m.ancestors.length > 0 ? m.ancestors[m.ancestors.length - 1] : null;
    const key = parent?.id ?? "__root__";
    const ancestorIds = m.ancestors.map((a) => a.id);

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        ancestorIds,
        headerHtml: buildBreadcrumbHtml(m.ancestors),
        matches: [],
      });
      groupOrder.push(key);
    }
    groupMap.get(key)!.matches.push(m.node);
  }

  return groupOrder.map((id) => groupMap.get(id)!);
}

function updateSelection(): void {
  if (!panelEl) return;
  panelEl.querySelectorAll(".fsp-item").forEach((el, i) => {
    el.classList.toggle("fsp-item-selected", i === selectedIndex);
    if (i === selectedIndex) el.scrollIntoView({ block: "nearest" });
  });
}

function selectItem(index: number): void {
  const item = flatItems[index];
  if (!item) return;
  store.state.currentPath = [...item.ancestorIds];
  store.lastFocusId = item.node.id;
  closeFlatSearch();
  clearSearchBox();
  _renderFn?.();
}

export function updateFlatSearch(query: string): void {
  if (!panelEl) return;

  const q = query.trim();
  flatItems = [];
  selectedIndex = -1;

  if (!q) {
    panelEl.innerHTML = '<div class="fsp-empty">検索ワードを入力してください</div>';
    return;
  }

  const matches = collectMatches(q);
  if (matches.length === 0) {
    panelEl.innerHTML = '<div class="fsp-empty">一致するノードがありません</div>';
    return;
  }

  const groups = groupResults(matches);
  panelEl.innerHTML = "";

  for (const group of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "fsp-group";

    const header = document.createElement("div");
    header.className = "fsp-group-header";
    header.innerHTML = group.headerHtml;
    groupEl.appendChild(header);

    for (const node of group.matches) {
      const itemEl = document.createElement("div");
      itemEl.className = "fsp-item";
      itemEl.innerHTML = highlightText(node.text || "(無題)", q);

      const itemIdx = flatItems.length;
      itemEl.addEventListener("mousemove", () => {
        selectedIndex = itemIdx;
        updateSelection();
      });
      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectItem(itemIdx);
      });

      flatItems.push({ node, ancestorIds: group.ancestorIds });
      groupEl.appendChild(itemEl);
    }

    panelEl.appendChild(groupEl);
  }
}

export function openFlatSearch(query: string): void {
  if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.id = "flat-search-panel";
    document.body.appendChild(panelEl);

    const searchBox = document.getElementById("search-box")!;
    const rect = searchBox.getBoundingClientRect();
    panelEl.style.top = `${rect.bottom + 4}px`;
    panelEl.style.left = `${rect.left}px`;
    panelEl.style.minWidth = `${Math.max(rect.width, 320)}px`;

    _outsideClickHandler = (e: MouseEvent) => {
      const sb = document.getElementById("search-box");
      if (panelEl && !panelEl.contains(e.target as Node) && e.target !== sb) {
        closeFlatSearch();
        clearSearchBox();
      }
    };
    document.addEventListener("mousedown", _outsideClickHandler);
  }
  updateFlatSearch(query);
}

export function handleFlatSearchKeydown(e: KeyboardEvent): boolean {
  if (!panelEl) return false;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, flatItems.length - 1);
    updateSelection();
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection();
    return true;
  }
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (selectedIndex >= 0) selectItem(selectedIndex);
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeFlatSearch();
    clearSearchBox();
    return true;
  }
  return false;
}

export function closeFlatSearch(): void {
  if (_outsideClickHandler) {
    document.removeEventListener("mousedown", _outsideClickHandler);
    _outsideClickHandler = null;
  }
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  flatItems = [];
  selectedIndex = -1;
}

function clearSearchBox(): void {
  const searchBox = document.getElementById("search-box") as HTMLInputElement;
  if (searchBox) {
    searchBox.value = "";
    store.searchQuery = "";
    applySearch();
    searchBox.blur();
  }
}

import { store } from "./store";
import { findNode, getPathToNode, moveNode, isDescendantOrSelf } from "./nodeHelpers";
import { createNode, saveState } from "./model";
import { recordHistory } from "./history";
import type { BloomlineNode } from "./types";

let _render: (() => void) | null = null;
let _saveState: (() => void) | null = null;

const SIDEBAR_STATE_KEY = "bloomline-sidebar-state";

function loadSidebarState(): { homeExpanded: boolean; expandedNodes: string[] } {
  try {
    const raw = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { homeExpanded: true, expandedNodes: [] };
}

function saveSidebarState(): void {
  localStorage.setItem(
    SIDEBAR_STATE_KEY,
    JSON.stringify({
      homeExpanded,
      expandedNodes: [...homeExpandedNodes],
    }),
  );
}

const _saved = loadSidebarState();
let sidebarVisible = true;
let sidebarDragSrcIndex: number | null = null;
let homeExpanded = _saved.homeExpanded;
const homeExpandedNodes = new Set<string>(_saved.expandedNodes);

function clearSidebarDropIndicators(): void {
  document
    .querySelectorAll(
      ".sidebar-home-item.sidebar-drop-above, .sidebar-home-item.sidebar-drop-below, .sidebar-home-item.sidebar-drop-child",
    )
    .forEach((el) =>
      el.classList.remove("sidebar-drop-above", "sidebar-drop-below", "sidebar-drop-child"),
    );
}

export function initSidebar(renderFn: () => void, saveStateFn: () => void): void {
  _render = renderFn;
  _saveState = saveStateFn;
}

function createHomeNodeEl(node: BloomlineNode, depth: number): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "sidebar-tree-node";

  const row = document.createElement("div");
  row.className = "sidebar-item sidebar-home-item";
  row.style.paddingLeft = `${12 + depth * 14}px`;

  const toggle = document.createElement("span");
  toggle.className = "sidebar-tree-toggle";
  if (node.children.length > 0) {
    const expanded = homeExpandedNodes.has(node.id);
    toggle.textContent = expanded ? "▼" : "▶";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (homeExpandedNodes.has(node.id)) {
        homeExpandedNodes.delete(node.id);
      } else {
        homeExpandedNodes.add(node.id);
      }
      saveSidebarState();
      renderHomeItems();
    });
  }

  const label = document.createElement("span");
  label.className = "sidebar-item-label";
  label.textContent = node.text || "(無題)";
  label.title = node.text || "(無題)";

  row.appendChild(toggle);
  row.appendChild(label);
  row.addEventListener("click", () => {
    const path = getPathToNode(node.id);
    if (path) {
      store.state.currentPath = path;
      _render?.();
    }
  });

  row.addEventListener("dragover", (e) => {
    if (!store.dragNodeId || store.dragNodeId === node.id) return;
    if (isDescendantOrSelf(store.dragNodeId, node.id)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    clearSidebarDropIndicators();
    const rect = row.getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.3) row.classList.add("sidebar-drop-above");
    else if (pct > 0.7) row.classList.add("sidebar-drop-below");
    else row.classList.add("sidebar-drop-child");
  });
  row.addEventListener("dragleave", (e) => {
    if (!row.contains(e.relatedTarget as Node)) {
      row.classList.remove("sidebar-drop-above", "sidebar-drop-below", "sidebar-drop-child");
    }
  });
  row.addEventListener("drop", (e) => {
    const srcId = e.dataTransfer!.getData("node-id");
    if (!srcId || srcId === node.id) return;
    if (isDescendantOrSelf(srcId, node.id)) return;
    e.preventDefault();
    e.stopPropagation();
    clearSidebarDropIndicators();
    const rect = row.getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    const position = pct < 0.3 ? "before" : pct > 0.7 ? "after" : "child";
    recordHistory();
    moveNode(srcId, node.id, position);
    _render?.();
  });

  wrapper.appendChild(row);

  if (node.children.length > 0 && homeExpandedNodes.has(node.id)) {
    const childContainer = document.createElement("div");
    node.children.forEach((child) => {
      childContainer.appendChild(createHomeNodeEl(child, depth + 1));
    });
    wrapper.appendChild(childContainer);
  }

  return wrapper;
}

function renderHomeItems(): void {
  const container = document.getElementById("sidebar-home-items")!;
  const toggle = document.getElementById("sidebar-home-toggle")!;
  container.innerHTML = "";
  toggle.textContent = homeExpanded ? "▼" : "▶";
  container.classList.toggle("hidden", !homeExpanded);
  if (!homeExpanded) return;

  store.state.root.children.forEach((node) => {
    container.appendChild(createHomeNodeEl(node, 0));
  });
}

export function addNewTopLevelNode(): void {
  recordHistory();
  const node = createNode("");
  store.state.root.children.push(node);
  store.lastFocusId = node.id;
  store.state.currentPath = [];
  _render?.();
  saveState();
}

export function renderSidebar(): void {
  const zone = document.getElementById("sidebar-drop-zone")!;
  const empty = document.getElementById("sidebar-empty")!;
  zone.querySelectorAll(".sidebar-item").forEach((el) => el.remove());

  store.state.pinnedItems = store.state.pinnedItems.filter((id) => !!findNode(id));

  if (store.state.pinnedItems.length === 0) {
    empty.style.display = "";
  } else {
    empty.style.display = "none";
    store.state.pinnedItems.forEach((nodeId, index) => {
      const found = findNode(nodeId);
      if (!found) return;
      const node = found.node;

      const item = document.createElement("div");
      item.className = "sidebar-item";
      item.draggable = true;
      item.dataset.index = String(index);

      const label = document.createElement("span");
      label.className = "sidebar-item-label";
      label.textContent = node.text || "(無題)";
      label.title = node.text || "(無題)";

      const removeBtn = document.createElement("span");
      removeBtn.className = "sidebar-item-remove";
      removeBtn.textContent = "✕";
      removeBtn.title = "削除";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        store.state.pinnedItems.splice(index, 1);
        _saveState?.();
        renderSidebar();
      });

      item.appendChild(label);
      item.appendChild(removeBtn);

      item.addEventListener("click", () => {
        const path = getPathToNode(nodeId);
        if (path) {
          store.state.currentPath = path;
          _render?.();
        }
      });

      item.addEventListener("dragstart", (e) => {
        sidebarDragSrcIndex = index;
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("sidebar-index", String(index));
        e.stopPropagation();
      });
      item.addEventListener("dragover", (e) => {
        if (sidebarDragSrcIndex === null) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        item.classList.remove("drag-over-top", "drag-over-bottom");
        item.classList.add(e.clientY < mid ? "drag-over-top" : "drag-over-bottom");
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over-top", "drag-over-bottom");
      });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove("drag-over-top", "drag-over-bottom");
        if (sidebarDragSrcIndex === null || sidebarDragSrcIndex === index) return;
        const rect = item.getBoundingClientRect();
        const insertAfter = e.clientY >= rect.top + rect.height / 2;
        const [moved] = store.state.pinnedItems.splice(sidebarDragSrcIndex, 1);
        const insertAt =
          sidebarDragSrcIndex < index
            ? insertAfter
              ? index
              : index - 1
            : insertAfter
              ? index + 1
              : index;
        store.state.pinnedItems.splice(insertAt, 0, moved);
        sidebarDragSrcIndex = null;
        _saveState?.();
        renderSidebar();
      });
      item.addEventListener("dragend", () => {
        sidebarDragSrcIndex = null;
        document
          .querySelectorAll(".sidebar-item")
          .forEach((el) => el.classList.remove("drag-over-top", "drag-over-bottom"));
      });

      zone.appendChild(item);
    });
  }

  renderHomeItems();
}

export function toggleHomeSection(): void {
  homeExpanded = !homeExpanded;
  saveSidebarState();
  renderHomeItems();
}

export function toggleSidebar(): void {
  sidebarVisible = !sidebarVisible;
  document.getElementById("sidebar")!.classList.toggle("hidden", !sidebarVisible);
}

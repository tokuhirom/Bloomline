import type { AppState, BloomlineNode } from './types';

export const store: {
  state: AppState;
  lastFocusId: string | null;
  lastFocusOffset: number | null;
  searchQuery: string;
  selAnchorId: string | null;
  selFocusId: string | null;
  suppressSelectionClear: boolean;
  isDragging: boolean;
  dragAnchorId: string | null;
  dragNodeId: string | null;
  hideChecked: boolean;
  clipboardNodes: BloomlineNode[] | null;
  clipboardIsCut: boolean;
} = {
  state: null as unknown as AppState, // set in main.ts before any render
  lastFocusId: null,
  lastFocusOffset: null,
  searchQuery: '',
  selAnchorId: null,
  selFocusId: null,
  suppressSelectionClear: false,
  isDragging: false,
  dragAnchorId: null,
  dragNodeId: null,
  hideChecked: false,
  clipboardNodes: null,
  clipboardIsCut: false,
};

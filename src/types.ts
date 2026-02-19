export interface BloomlineNode {
  id: string;
  text: string;
  note: string;
  children: BloomlineNode[];
  collapsed: boolean;
  checked?: boolean; // undefined = not a todo, false = unchecked, true = checked
  calendarType?: 'root' | 'year' | 'month' | 'day'; // calendar hierarchy
}

export interface AppState {
  root: BloomlineNode;
  currentPath: string[];
  title: string;
  pinnedItems: string[];
  version: number;
}

export type DropPosition = 'before' | 'after' | 'child';

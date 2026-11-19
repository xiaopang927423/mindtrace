export type CardType =
  | "requirement"
  | "idea"
  | "evidence"
  | "judgment"
  | "decision"
  | "validation";
export interface Card {
  id: string;
  type: CardType;
  title: string;
  parentId: string | null;
  body: string;
  bodyHtml?: string;
  created: string;
  updated: string;
  origin: string;
  confirmed: boolean;
  revision: number;
  history: { at: string; content: CardSnapshot }[];
  needsReview: boolean;
  conclusion: string;
  progress: string;
  outcome: string;
  choices: Record<string, string>;
  collapsed: boolean;
  deleted: boolean;
  x?: number;
  y?: number;
  [field: string]: any;
}
export type CardSnapshot = Omit<Card, "history">;
export interface Link {
  id: string;
  from: string;
  to: string;
  type: string;
}
export interface Section {
  key: string;
  title: string;
  text: string;
}
export interface Source {
  id: string;
  revision: number;
  title: string;
  content: CardSnapshot;
}
export interface PRDocument {
  id: string;
  version: number;
  created: string;
  sections: Section[];
  sources: Source[];
  needsReview: boolean;
  previous?: PRDocument[];
}
export interface Attachment {
  id: string;
  name: string;
  data: string;
  mime?: string;
}
export interface Project {
  id: string;
  title: string;
  goal: string;
  created: string;
  updated: string;
  cards: Card[];
  links: Link[];
  documents: PRDocument[];
  attachments: Attachment[];
  acceptedSuggestions: string[];
}
export interface Workspace {
  schema: 1;
  projects: Project[];
  currentProject: string;
}
export interface Settings {
  endpoint: string;
  model: string;
  hasKey?: boolean;
  hasSearchKey?: boolean;
}
export type Suggestion = Partial<Card> & {
  id: string;
  type: CardType;
  title: string;
  accepted?: boolean;
};
export interface DesktopBridge {
  invoke(action: string, payload?: Record<string, unknown>): Promise<any>;
  onCommand(callback: (command: string) => void): void;
  onFlush(callback: () => Promise<void>): void;
}
declare global {
  interface Window {
    mindtrace?: DesktopBridge;
    flushMindTrace?: () => Promise<void>;
  }
}

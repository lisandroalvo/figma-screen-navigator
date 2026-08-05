export type IndexingStrategy =
  | "direct_children"
  | "approved_groups"
  | "recursive"
  | "manual_include";

export type HierarchyPattern =
  | "breakpoint_contains_screens"
  | "screen_contains_breakpoints"
  | "group_contains_breakpoint_variants"
  | "screen_group_contains_screens"
  | "direct_page_screens"
  | "unknown";

export interface PageConfig {
  strategy: IndexingStrategy;
  hierarchyPattern: HierarchyPattern;
  allowedGroupPatterns?: RegExp[];
  allowedDirectChildren?: boolean;
  maxDepth: number;
  minWidth: number;
  minWidthRatio: number;
  minHeight: number;
  manualIncludeIds?: string[];
  manualExcludeIds?: string[];
}

export interface ModuleConfig {
  fileKey: string;
  defaultPageConfig: PageConfig;
  pageConfigs: Record<string, PageConfig>;
  ignoreNamePatterns: RegExp[];
  componentParentPatterns: RegExp[];
  shellChildPatterns: RegExp[];
  behaviorKeywords: string[];
}

const DEFAULT_PAGE: PageConfig = {
  strategy: "direct_children",
  hierarchyPattern: "screen_group_contains_screens",
  allowedDirectChildren: true,
  maxDepth: 4,
  minWidth: 200,
  minWidthRatio: 0.35,
  minHeight: 200,
};

const FLOOR_DETAIL: PageConfig = {
  strategy: "direct_children",
  hierarchyPattern: "screen_group_contains_screens",
  allowedDirectChildren: true,
  maxDepth: 3,
  minWidth: 200,
  minWidthRatio: 0.25,
  minHeight: 200,
};

export const pilotConfig: ModuleConfig = {
  fileKey: "",
  defaultPageConfig: DEFAULT_PAGE,
  pageConfigs: {
    "list estimates calculations": DEFAULT_PAGE,
    "floor detail": FLOOR_DETAIL,
    "accrual detail": DEFAULT_PAGE,
    "calculation detail": DEFAULT_PAGE,
    "estimate detail": DEFAULT_PAGE,
  },
  ignoreNamePatterns: [
    /\bcopy\b/i,
    /\btest\b/i,
    /\bold\b/i,
    /\barchive\b/i,
    /\barchived\b/i,
    /\bdeprecated\b/i,
    /\bfinal new\b/i,
    /\bv2\b/i,
    /\bbackup\b/i,
    /\btemp\b/i,
    /\bscratch\b/i,
    /\bframe\s+\d+/i,
    /\brectangle\s+\d+/i,
    /\bgroup\s+\d+/i,
    /\bellipse\s+\d+/i,
    /\bnote\b/i,
    /\bimage\b/i,
    /^arrow/i,
    /^vector/i,
    /^text\s/i,
    /^stage[-\s]/i,
    /^link\s+stages/i,
    /\b(header|chips|widget|rows|property)\b/i,
    /\b(button)\b/i,
    /\bpension calculation[-\s]table\b/i,
    /\btable[-\s](?:header|rows)\b/i,
    /\bside[-\s]?bar\b/i,
    /\bbottom[-\s]?navigation\b/i,
    /\bparticipant[-\s]?menu[-\s]?items\b/i,
    /\bstages[-\s]?section\b/i,
    /\badjustment[-\s]?tab[-\s]?conteiner\b/i,
    /\bcard\b/i,
    /\bmenu[-\s]?items\b/i,
    /^modal\s*$/i,
  ],
  componentParentPatterns: [
    /\b(side[-\s]?bar|header|footer|nav|navigation|bottom)\b/i,
    /\b(table|row|col|column|cell)\b/i,
    /\b(modal|popover|tooltip|accordion|dropdown|toast|drawer)\b/i,
    /\b(card|widget|chip|badge|button|input|field|form)\b/i,
    /\b(tab|tab[-\s]?bar|tab[-\s]?item)\b/i,
  ],
  shellChildPatterns: [
    /\b(header|side[-\s]?bar|navigation|nav|footer|content|main)\b/i,
  ],
  behaviorKeywords: [
    "Tooltip",
    "Popover",
    "Modal",
    "Accordion",
    "Drawer",
    "Dropdown",
    "Toast",
  ],
};

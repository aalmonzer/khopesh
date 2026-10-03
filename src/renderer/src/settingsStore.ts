import type { SplitSettings } from "../../shared/types";

export const DEFAULT_SETTINGS: SplitSettings = { chunkSize: 143325, overlap: 1 };

export const CHUNK_OPTIONS = [
  { value: 143325, label: "Small — uses ~1.9 GB (default)" },
  { value: 286650, label: "Medium — uses ~3.8 GB" },
  { value: 573300, label: "Large — uses ~7.5 GB" },
];

export const OVERLAP_OPTIONS = [
  { value: 1, label: "1 — fastest (default)" },
  { value: 2, label: "2 — about 2× slower" },
  { value: 3, label: "3 — about 3× slower" },
  { value: 4, label: "4 — about 4× slower" },
];

const KEY = "khopesh.settings";

export const loadSettings = (): SplitSettings => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: SplitSettings) =>
  localStorage.setItem(KEY, JSON.stringify(settings));

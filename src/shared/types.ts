export interface SplitSettings {
  chunkSize: number;
  overlap: number;
}

export interface SplitProgress {
  stage: string;
  percent: number;
}

export interface SplitResult {
  vocals: string;
  instrumental: string;
}

export interface KhopeshApi {
  platform: string;
  pathForFile(file: File): string;
  chooseFiles(): Promise<string[]>;
  isModelReady(): Promise<boolean>;
  downloadModel(): Promise<void>;
  split(filePath: string, settings: SplitSettings): Promise<SplitResult>;
  cancel(): void;
  showInFolder(filePath: string): void;
  onProgress(listener: (progress: SplitProgress) => void): () => void;
}

export const AUDIO_EXTENSIONS = [
  "wav", "mp3", "flac", "m4a", "aac", "aif", "aiff", "caf", "mp4", "mov", "m4v",
];

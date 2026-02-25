export type FormMode = "dev" | "production";

export type TabMode = "TEXT_INPUT" | "AUDIO_FILE" | "JSON_INPUT" | "PRODUCTION";

export const TABS_BY_MODE: Record<FormMode, TabMode[]> = {
  dev: ["TEXT_INPUT", "AUDIO_FILE", "JSON_INPUT", "PRODUCTION"],
  production: ["PRODUCTION", "TEXT_INPUT"],
};

export const TAB_LABELS: Record<TabMode, string> = {
  TEXT_INPUT: "テキスト入力",
  AUDIO_FILE: "音声ファイル",
  JSON_INPUT: "JSON入力",
  PRODUCTION: "本番（録音）",
};

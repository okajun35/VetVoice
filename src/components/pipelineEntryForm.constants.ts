export type FormMode = "dev" | "production";

export type TabMode = "TEXT_INPUT" | "AUDIO_FILE" | "JSON_INPUT" | "PRODUCTION";

export const TABS_BY_MODE: Record<FormMode, TabMode[]> = {
  dev: ["TEXT_INPUT", "AUDIO_FILE", "JSON_INPUT", "PRODUCTION"],
  production: ["PRODUCTION", "TEXT_INPUT"],
};

export const TAB_LABELS: Record<TabMode, string> = {
  TEXT_INPUT: "Text Input",
  AUDIO_FILE: "Audio File",
  JSON_INPUT: "JSON Input",
  PRODUCTION: "Production (Recording)",
};

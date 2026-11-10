export type ColorLabel =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "purple";

export const COLOR_LABELS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "aqua",
  "blue",
  "purple",
] as const;

export const COLOR_LABEL_NAMES: Record<ColorLabel, string> = {
  gray: "グレー",
  red: "レッド",
  orange: "オレンジ",
  yellow: "イエロー",
  green: "グリーン",
  aqua: "アクア",
  blue: "ブルー",
  purple: "パープル",
};

export const COLOR_LABEL_SWATCH: Record<ColorLabel, string> = {
  gray: "#abb8c3",
  red: "#ff716d",
  orange: "#ff9976",
  yellow: "#ffe577",
  green: "#94d77a",
  aqua: "#56d9c8",
  blue: "#4fc3ff",
  purple: "#d59bff",
};

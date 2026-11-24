export const palettes = {
  navy: { label: "Midnight", color: "#102a56", soft: "#dce5f0" },
  blue: { label: "Ocean blue", color: "#2459b3", soft: "#e3edff" },
  teal: { label: "Deep teal", color: "#146c73", soft: "#d9f0ef" },
  emerald: { label: "Forest", color: "#246647", soft: "#e0f0e5" },
  rose: { label: "Rose", color: "#9a3858", soft: "#f6e3eb" },
  amber: { label: "Warm amber", color: "#855418", soft: "#f7ecd9" },
  indigo: { label: "Indigo", color: "#45459b", soft: "#e8e7fa" },
  plum: { label: "Plum", color: "#744273", soft: "#f0e3f0" },
  coral: { label: "Coral", color: "#a74436", soft: "#fae5df" },
  copper: { label: "Copper", color: "#88512f", soft: "#f4e7db" },
  olive: { label: "Olive", color: "#60642b", soft: "#eef0dd" },
  sage: { label: "Sage", color: "#47705b", soft: "#e1eee5" },
  cyan: { label: "Lagoon", color: "#1c687c", soft: "#dff0f5" },
  slate: { label: "Slate", color: "#46566f", soft: "#e6ebf2" },
  graphite: { label: "Graphite", color: "#41434b", soft: "#e9e9ed" },
  burgundy: { label: "Burgundy", color: "#7c2f43", soft: "#f3e0e6" },
  orange: { label: "Studio orange", color: "#c2470c", soft: "#ffe4d1" },
  tangerine: { label: "Tangerine", color: "#b94b16", soft: "#ffeadb" },
  terracotta: { label: "Terracotta", color: "#a9472c", soft: "#f8e3da" },
  marigold: { label: "Marigold", color: "#8b5b08", soft: "#fff0c7" },
  raspberry: { label: "Raspberry", color: "#9e315b", soft: "#f8e1eb" },
  ocean: { label: "Deep ocean", color: "#165477", soft: "#dcecf5" },
} as const;
export type Theme = {
  themeAccent: keyof typeof palettes;
  themeMode: "light" | "dark" | "system";
};
export type ThemeScope = "website" | "admin";
export function normalizeTheme(
  data: Record<string, unknown> = {},
  scope: ThemeScope = "website",
): Theme {
  const accent = data[`${scope}ThemeAccent`] || data.themeAccent;
  const mode = data[`${scope}ThemeMode`] || data.themeMode;
  return {
    themeAccent: Object.hasOwn(palettes, String(accent))
      ? (accent as Theme["themeAccent"])
      : "navy",
    themeMode: ["light", "dark", "system"].includes(String(mode))
      ? (mode as Theme["themeMode"])
      : "light",
  };
}

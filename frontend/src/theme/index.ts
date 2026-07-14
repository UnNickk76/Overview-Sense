// OverView design tokens — Apple-style scientific instrument (Black / Gold / Blue).
export const colors = {
  surface: "#000000",
  onSurface: "#F5F5F7",
  surfaceSecondary: "#0A0B0E",
  onSurfaceSecondary: "#A1A1A6",
  surfaceTertiary: "#15161A",
  onSurfaceTertiary: "#C6C6C8",
  brand: "#D4AF37",
  onBrand: "#000000",
  blue: "#0A84FF",
  onBlue: "#FFFFFF",
  tertiary: "#1A1D24",
  success: "#32D74B",
  warning: "#FFD60A",
  error: "#FF453A",
  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  divider: "#1C1C1E",
  glassTint: "rgba(26,29,36,0.75)",
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48,
} as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const fonts = {
  regular: "Geist",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
  mono: "GeistMono",
  monoMedium: "GeistMono-Medium",
} as const;

export const type = {
  sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 48,
} as const;

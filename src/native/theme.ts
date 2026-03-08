/**
 * Shared UI constants for consistent modals, buttons, and cards across the app.
 */

export const theme = {
  colors: {
    primary: "#9333ea",
    primaryText: "#fff",
    secondaryBg: "#ede9fe",
    secondaryBorder: "#e9d5ff",
    surface: "#fff",
    surfaceMuted: "#f9fafb",
    chipInactiveBg: "#f3f4f6",
    chipInactiveBorder: "#d1d5db",
    chipInactiveText: "#6b7280",
    text: "#1f2937",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    success: "#10b981",
    error: "#dc2626",
    overlay: "rgba(0,0,0,0.45)",
  },
  modal: {
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      padding: 24,
    },
    card: {
      width: "100%" as const,
      maxWidth: 340,
      backgroundColor: "#fff",
      borderRadius: 20,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: "#1f2937",
      marginBottom: 4,
      textAlign: "center" as const,
    },
    message: {
      fontSize: 14,
      color: "#6b7280",
      textAlign: "center" as const,
    },
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    primary: {
      backgroundColor: "#9333ea",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: "#fff",
    },
    secondary: {
      backgroundColor: "#f3f4f6",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1.5,
      borderColor: "#d1d5db",
    },
    secondaryText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: "#6b7280",
    },
    cancelText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: "#6b7280",
    },
  },
  card: {
    borderRadius: 16,
    borderRadiusSmall: 12,
    padding: 16,
    paddingLarge: 24,
  },
} as const;

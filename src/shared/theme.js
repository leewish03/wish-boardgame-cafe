// =========================================================================
// Wish Boardgame Cafe: Modern Marble Base & Love Letter Renaissance Theme
// =========================================================================

export const MARBLE_BASE_THEME = {
  // === Carrara & Onyx Marble Surfaces ===
  background: '#f8fafc',             // Carrara White stone
  backgroundSecondary: '#f1f5f9',
  surfaceCard: '#ffffff',            // Polished White Marble Slab
  surfaceCardGlass: 'rgba(255, 255, 255, 0.88)',
  foreground: '#0f172a',            // Deep Slate Charcoal for ultra-crisp typography
  cardForeground: '#0f172a',
  popover: '#ffffff',
  popoverForeground: '#0f172a',

  // === UI Buttons & Form Elements ===
  primary: '#0f172a',               // Deep Slate primary
  primaryForeground: '#ffffff',
  secondary: '#f1f5f9',             // Light stone
  secondaryForeground: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',       // Slate muted text
  accent: '#f8fafc',
  accentForeground: '#0f172a',
  destructive: '#be123c',           // Ruby Rose
  destructiveForeground: '#ffffff',
  border: '#e2e8f0',                // 1px subtle stone border
  borderGold: 'rgba(212, 175, 55, 0.65)',
  input: '#e2e8f0',
  ring: '#d4af37',

  // === Luxury Marble & Metal Accents ===
  gold: '#d4af37',                  // Champagne Gold
  goldLight: '#fef08a',
  goldAntique: '#c5a059',
  goldGlow: 'rgba(212, 175, 55, 0.45)',
  burgundy: '#7b1836',              // Royal Burgundy (Love Letter wax seal)
  burgundyDeep: '#4c0519',
  burgundyGlow: 'rgba(123, 24, 54, 0.45)',
  emerald: '#059669',               // Jade Emerald
  emeraldGlow: 'rgba(5, 150, 105, 0.4)',
  rose: '#e11d48',                  // Rose Ruby
  indigo: '#4f46e5',
  slateDark: '#0f172a',

  // === Marble Gradients ===
  gradients: {
    marbleBase: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    marbleSlab: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.92) 100%)',
    jadeOnyxSlab: 'linear-gradient(135deg, rgba(240, 253, 244, 0.95) 0%, rgba(209, 250, 229, 0.9) 100%)',
    marbleTable: `
      radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8fafc 40%, #f1f5f9 70%, #e2e8f0 100%)
    `,
    goldShimmer: 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #b45309 100%)',
    burgundySeal: 'linear-gradient(135deg, #9f1239 0%, #7b1836 50%, #4c0519 100%)',
  },

  // === Border Radius ===
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // === Shadows ===
  shadows: {
    marbleSlab: '0 4px 20px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05)',
    marbleCardHover: '0 12px 30px rgba(15, 23, 42, 0.12), 0 0 15px rgba(212, 175, 55, 0.3)',
    goldNeon: '0 0 20px rgba(212, 175, 55, 0.55)',
    burgundyNeon: '0 0 20px rgba(123, 24, 54, 0.6)',
  },

  // === Typography Stack ===
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: '"Playfair Display", "Cinzel", "Georgia", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

export const LOVE_LETTER_THEME = {
  ...MARBLE_BASE_THEME,
  name: 'love-letter-renaissance',
  cardSlab: '#ffffff',
  tableBackground: MARBLE_BASE_THEME.gradients.marbleTable,
  damaskCardBack: '#6d1229',
};

// Global default export for seamless backward compatibility
export const THEME = MARBLE_BASE_THEME;

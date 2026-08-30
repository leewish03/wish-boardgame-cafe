// =========================================================================
// Wish Boardgame Salon: "Private VIP Salon" Luxury Marble & Brass Tokens
// =========================================================================

export const MARBLE_BASE_THEME = {
  // === Carrara Marble & Obsidian Surfaces ===
  background: '#f4f6f8',             // Warm Carrara tint
  backgroundSecondary: '#e9eef2',
  surfaceCard: '#ffffff',            // Polished White Carrara Marble Slab
  surfaceCardGlass: 'rgba(255, 255, 255, 0.94)',
  foreground: '#090d16',            // Deep Obsidian Slate for ultra-crisp editorial typography
  cardForeground: '#090d16',
  popover: '#ffffff',
  popoverForeground: '#090d16',

  // === UI Buttons & Form Elements ===
  primary: '#090d16',               // Deep Obsidian Slate primary
  primaryForeground: '#f8fafc',
  secondary: '#f1f5f9',             // Light stone
  secondaryForeground: '#090d16',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',       // Slate muted text
  accent: '#f8fafc',
  accentForeground: '#090d16',
  destructive: '#9f1239',           // Vintage Carmine
  destructiveForeground: '#ffffff',
  border: '#e2e8f0',                // 1px subtle stone border
  borderGold: '#c5a059',            // Champagne Hairline Brass
  input: '#cbd5e1',
  ring: '#c5a059',

  // === Luxury Marble & Metal Accents ===
  gold: '#c5a059',                  // Champagne Hairline Brass
  goldLight: '#e6ca85',
  goldAntique: '#9a7b38',
  goldGlow: 'rgba(197, 160, 89, 0.35)',
  burgundy: '#631326',              // Royal Burgundy (Heritage wax seal)
  burgundyDeep: '#3b0b17',
  burgundyGlow: 'rgba(99, 19, 38, 0.35)',
  emerald: '#047857',               // Jade Emerald
  emeraldGlow: 'rgba(4, 120, 87, 0.35)',
  rose: '#be123c',
  indigo: '#3730a3',
  slateDark: '#090d16',

  // === Marble Gradients & Textures ===
  gradients: {
    marbleBase: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    marbleSlab: `
      linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.94) 100%)
    `,
    marbleTextureUrl: "url('/assets/carrara_marble.jpg')",
    doubleBrassInlay: '0 0 0 1px #c5a059, 0 0 0 3px rgba(197, 160, 89, 0.25)',
    goldShimmer: 'linear-gradient(135deg, #fef08a 0%, #c5a059 50%, #8c6d31 100%)',
    obsidianButton: 'linear-gradient(135deg, #1e293b 0%, #090d16 100%)',
    burgundySeal: 'linear-gradient(135deg, #881337 0%, #631326 50%, #3b0b17 100%)',
  },

  // === Border Radius ===
  radius: {
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '14px',
    full: '9999px',
  },

  // === Shadows ===
  shadows: {
    marbleSlab: '0 10px 30px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    marbleCardHover: '0 16px 36px rgba(15, 23, 42, 0.12), 0 0 20px rgba(197, 160, 89, 0.25)',
    goldNeon: '0 0 20px rgba(197, 160, 89, 0.45)',
    burgundyNeon: '0 0 20px rgba(99, 19, 38, 0.5)',
  },

  // === Typography Stack ===
  font: {
    serif: '"Cinzel", "Noto Serif KR", Georgia, serif',
    display: '"Cormorant Garamond", "Noto Serif KR", Georgia, serif',
    koreanSerif: '"Noto Serif KR", serif',
    sans: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

export const LOVE_LETTER_THEME = {
  ...MARBLE_BASE_THEME,
  name: 'love-letter-renaissance',
  cardSlab: '#ffffff',
  tableBackground: "url('/assets/carrara_marble.jpg')",
  damaskCardBack: '#540f20',
};

// Global default export for seamless backward compatibility
export const THEME = MARBLE_BASE_THEME;

// =========================================================================
// shadcn/ui Dark Zinc Theme Tokens + Custom Board Game Accents
// =========================================================================

export const THEME = {
  // === shadcn/ui Dark Zinc Official Tokens ===
  background: '#09090b',        // hsl(240, 10%, 3.9%)
  foreground: '#fafafa',        // hsl(0, 0%, 98%)
  card: '#09090b',              // 카드 배경 (1px border-zinc-800로 구분)
  cardForeground: '#fafafa',
  popover: '#09090b',
  popoverForeground: '#fafafa',
  primary: '#fafafa',           // Dark mode primary button surface (White)
  primaryForeground: '#18181b', // Dark mode primary text (Black)
  secondary: '#27272a',         // hsl(240, 3.7%, 15.9%)
  secondaryForeground: '#fafafa',
  muted: '#27272a',
  mutedForeground: '#a1a1aa',   // hsl(240, 5%, 64.9%)
  accent: '#27272a',
  accentForeground: '#fafafa',
  destructive: '#7f1d1d',
  destructiveForeground: '#fafafa',
  border: '#27272a',            // 1px 미세 보더
  input: '#27272a',
  ring: '#d4d4d8',

  // === Wish Boardgame Cafe Custom Accents ===
  gold: '#f59e0b',              // 샴페인 골드 (카드 테두리, 우승 강조)
  goldLight: '#fbbf24',
  emerald: '#10b981',           // 에메랄드 (준비 완료, VAD 발화 감지)
  emeraldGlow: 'rgba(16, 185, 129, 0.4)',
  feltGreen: '#064e3b',         // 카지노 펠트 테이블 배경
  feltGreenDeep: '#022c22',
  rose: '#f43f5e',              // 탈락/공주 카드 위험
  indigo: '#6366f1',            // 정보/경비병 액센트

  // === Border Radius Specs ===
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },

  // === Typography Stack ===
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

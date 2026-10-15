export function bullheads(card) {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  return card % 5 === 0 ? 2 : 1;
}
export const rowPoints = row => row.reduce((sum, card) => sum + bullheads(card), 0);

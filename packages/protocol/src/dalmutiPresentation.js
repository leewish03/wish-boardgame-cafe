export function dalmutiPresentationMs(type) {
  return ({ ROUND_DEALT: 800, SET_PLAYED: 1400, PASSED: 1000, TRICK_CLEARED: 1600,
    TAX_COMPLETED: 1800, REVOLUTION: 1800, GREAT_REVOLUTION: 1800,
    MERCHANT_EXCHANGED: 1400, ROUND_ENDED: 500, MATCH_ENDED: 500 })[type] || 1200;
}

export function dalmutiPresentationDeadline(events) {
  return events.reduce((total, event) => total + dalmutiPresentationMs(event.type), 0) + 1000;
}

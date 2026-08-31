export const MOTION_TOKENS = {
  // Durations (in seconds)
  duration: {
    micro: 0.15,         // Micro feedback: 100~180ms
    uiTransition: 0.22,  // UI state transition: 160~280ms
    cardFlight: 0.38,    // Card movement: 250~500ms
    actionPhase: 0.45,   // Action phase reveal
    settle: 0.25,        // Settle & transition
    dramatic: 1.0,       // Dramatic climax
  },

  // Millisecond equivalents for timeouts
  timingMs: {
    micro: 150,
    uiTransition: 220,
    cardFlight: 380,
    phaseWhoCard: 350,
    phaseTarget: 350,
    phaseEffect: 550,
    phaseResult: 500,
    phaseDiscard: 350,
    phaseSettle: 250,
  },

  // Card specific total presentation durations (approx 1.8s ~ 3.2s)
  cardDurationsMs: {
    1: 2300, // Guard (1): WHO -> TARGET -> GUESS -> MATCH/MISS -> DISCARD -> SETTLE
    2: 2200, // Priest (2): WHO -> TARGET -> REVEAL PEEK -> SETTLE
    3: 2600, // Baron (3): WHO -> TARGET -> DUEL CLASH -> LOSER REVEAL -> SETTLE
    4: 1800, // Handmaid (4): WHO -> SHIELD DEPLOY -> SETTLE
    5: 2300, // Prince (5): WHO -> TARGET -> DISCARD HAND -> DRAW/ELIM -> SETTLE
    6: 2400, // King (6): WHO -> TARGET -> CARD BACK SWAP -> SETTLE
    7: 1800, // Countess (7): WHO -> ROYAL DISCARD -> SETTLE
    8: 2000, // Princess (8): WHO -> PLAY -> SELF ELIMINATION -> SETTLE
    default: 2000,
  },

  // Framer Motion Springs
  spring: {
    snappy: { type: 'spring', stiffness: 350, damping: 25 },
    cardDeal: { type: 'spring', stiffness: 280, damping: 22, mass: 0.8 },
    cardPlay: { type: 'spring', stiffness: 350, damping: 26, mass: 1.0 },
    impact: { type: 'spring', stiffness: 600, damping: 18, mass: 1.5 },
    deflect: { type: 'spring', stiffness: 450, damping: 12, mass: 0.6 },
    gentle: { type: 'spring', stiffness: 180, damping: 22 },
    bounce: { type: 'spring', stiffness: 400, damping: 15 },
  },

  // Easing tokens
  ease: {
    luxury: [0.16, 1, 0.3, 1],      // Champagne Salon luxury cubic-bezier
    sharp: [0.4, 0, 0.2, 1],
    smooth: [0.25, 0.1, 0.25, 1],
    reveal: [0.16, 1, 0.3, 1],
    vortex: [0.7, 0, 0.84, 0],
    deflect: [0.68, -0.55, 0.27, 1.55],
  },
} as const;


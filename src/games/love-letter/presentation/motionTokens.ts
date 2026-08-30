export const MOTION_TOKENS = {
  // Durations (in seconds)
  duration: {
    micro: 0.15,
    quick: 0.22,
    normal: 0.35,
    cardFlight: 0.5,
    actionSequence: 0.85,
    dramatic: 1.2,
  },

  // Framer Motion Springs
  spring: {
    snappy: { type: 'spring', stiffness: 350, damping: 25 },
    cardDeal: { type: 'spring', stiffness: 220, damping: 20, mass: 1.15 },
    gentle: { type: 'spring', stiffness: 180, damping: 22 },
    bounce: { type: 'spring', stiffness: 400, damping: 15 },
  },

  // Easing
  ease: {
    luxury: [0.16, 1, 0.3, 1], // Custom cubic bezier for high-end luxury feel
    sharp: [0.4, 0, 0.2, 1],
    smooth: [0.25, 0.1, 0.25, 1],
  },
} as const;

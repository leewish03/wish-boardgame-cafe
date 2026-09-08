# Fixed card artwork — 2026-09-09

CURRENT BEHAVIOR
→ Hand cards, travelling cards and public discards used three different designs.
The motion layer animated width/height independently; hand slots also measured
larger than the card. Text reflowed, descriptions were clamped, and a receiving
hand could briefly contain a square card.

ROOT CAUSE
→ Responsive HTML typesetting inside changing boxes, mismatched source/landing
geometry, layout projection plus CSS transform transitions, and post-paint
measurement of the travelling replacement.

DESIRED EXPERIENCE
→ A card retains its printed identity and aspect ratio from hand to play area,
private review, discard and draw destination.

STATE FLOW
→ Existing server events → existing presentation steps → completion callback
→ existing authoritative settling. No rule, socket or private-data changes.

VISUAL FLOW
→ One SVG print at 154 × 220 → translation/uniform scale/rotation of its wrapper
→ same SVG at its destination. Geometry is initialized before paint. Card backs
also share the same print. The set-aside anchor measures the card, not its label.

IMPLEMENTATION OPTIONS
→ Raster assets would freeze typography but introduce image loading and scaling
quality concerns. Fixed SVG preserves layout without a loading phase and retains
accessible text. A responsive DOM card would still need internal scaling and
more layout synchronization.

SELECTED APPROACH
→ Shared memoized CardArtwork, explicit SVG printing coordinates, complete rule
copy without line clamping; Framer Motion animates only the fixed-size wrapper.
Hand slots and discard landing areas preserve the same aspect ratio. Remove
competing layout/CSS transform animations and per-step opacity resets.

RISKS
→ Tiny public cards intentionally cannot show full readable rule text; the
existing discard inspector remains available. Browser rasterization may vary
across devices. Desktop/mobile browser emulation does not certify every Android
GPU or browser version.

VERIFICATION
→ Existing 14 test suites passed (81.75 seconds), typecheck and production build
passed. In-app Chromium: 390×844 / 360×640 / 1280×900, 2/4/6-player fixtures using
the actual LoveLetterGame and local authoritative Socket.IO service.
Inspected Priest review/return, Prince self-discard/replacement, King exchange,
rapid double confirm/return clicks, and resize plus reload during private review.
Reviewed screenshots at play, review and settled stages; final console errors [].
The user-supplied photos and pre-change local DOM supplied the comparison baseline.

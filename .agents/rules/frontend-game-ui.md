# Frontend Game UI & Motion Rules (Always On)

This rule is always active for frontend and game development in Wish Boardgame Cafe.

## 1. Core Principles
- **This is a board game, not a dashboard**: The player must perceive a physical table, game objects, opponents, actions, cause, and consequence.
- **Physicality & Visual Continuity**: Cards, decks, discard piles, tokens, and seats are persistent physical objects. State changes must not appear as random teleportation.
- **Causality**: Every game action must clearly convey `ACTOR → ACTION → TARGET → RESULT`.
- **Motion Has a Purpose**: Animation exists to explain game state transitions, actions, spatial continuity, selection, and turn hierarchy—not as decorative distraction.

## 2. Framework & Animation Standards
- **Framer Motion**: Always prefer Framer Motion for position/layout transitions, spring movement, enter/exit, gesture feedback, and sequenced state transitions.
- **styled-components CSS Keyframes**: Restrict to ambient, subtle repeating decorative effects. Never build core game state transitions as scattered independent CSS keyframes.
- **No `transition: all`**: Use explicit animated properties (`transform`, `opacity`, etc.).

## 3. Forbidden Shortcuts
Do NOT compensate for weak interaction design by adding:
- excessive box-shadow / glows
- animation: pulse
- scale(1.05) jumps
- generic full-screen modals for basic gameplay
- arbitrary setTimeout chains to control logic

## 4. Zero-Modal Game Board Interaction
- Prefer on-table spatial selection and in-place feedback (Thumb-Zone chips, seat targeting).
- Modals are strictly reserved for information that cannot be legibly displayed on the table surface.

## 5. Server-Authoritative State vs Presentation State
- Server state is authoritative.
- Never compromise server authority or leak hidden information to make UI/animation easier.
- Separate authoritative game state from local transient animation state.
- Always converge UI onto authoritative server snapshots.

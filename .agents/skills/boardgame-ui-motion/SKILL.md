---
name: boardgame-ui-motion
description: Designs, implements, refactors, and visually verifies interactive board-game UI, card interactions, spatial feedback, targeting, turn transitions, game-state animation, Framer Motion sequences, and gameplay visual effects for Wish Boardgame Cafe. Use for any task involving game UI, animation, cards, player seats, visual feedback, layout, interaction, or gameplay presentation.
---

# Boardgame UI & Motion Skill

Use this skill whenever working on the interactive game surface.
This includes:
- cards, hands, decks, discard piles
- players, player seats, targeting
- turn indicators, game effects, action visualization
- game overlays, responsive game layouts
- Framer Motion, gameplay animation, visual polish

## Phase 1 — Inspect
Do not edit immediately. Read the relevant implementation.
For Love Letter, inspect as needed:
- `src/games/love-letter/LoveLetterBoard.jsx`
- `src/games/love-letter/ActionVisualizer.jsx`
- `src/shared/components.jsx`
- `src/shared/theme.js`
- related hooks, server game logic, and Socket.IO handlers
Also inspect the running UI in the browser for visual tasks. Do not rely only on source code.

## Phase 2 — Trace the Interaction
Describe the interaction as:
```
USER OR SERVER EVENT
↓
AUTHORITATIVE GAME STATE
↓
LOCAL PRESENTATION STATE
↓
VISIBLE FEEDBACK
↓
ANIMATION
↓
FINAL SETTLED STATE
```
Identify whether the current implementation skips necessary intermediate visual states.

## Phase 3 — Define the Experience
For every meaningful interaction define:
- **Trigger**: What starts the interaction?
- **Actor**: Which player or object performs it?
- **Object**: Which card/token/object participates?
- **Target**: Who or what receives the action?
- **Spatial relationship**: Where does the visual action begin and end?
- **Feedback**: How does the user know the interaction was accepted?
- **Motion**: What movement explains the change?
- **Result**: How is success/failure/protection/elimination/etc. communicated?
- **Settle**: What does the table look like after the sequence?
- **Interrupt behavior**: What happens if another event arrives before completion?

## Phase 4 — Evaluate Existing UX
For the affected interaction evaluate:
- discoverability, hierarchy, physicality, causality, visual continuity, feedback, animation purpose, responsiveness, accessibility, reliability.
Do not treat decorative polish as equivalent to interaction quality.

## Phase 5 — Choose the Implementation Strategy
Prefer the smallest robust architecture.
For spatial/stateful animation, prefer Framer Motion:
- `layout`, `layoutId`, `AnimatePresence`, `variants`, motion values, spring transitions, explicit animation phase state.
Use CSS keyframes mainly for ambient effects. Avoid implementing meaningful game sequences with unrelated timers.

## Phase 6 — Implement One Coherent Behavior
Keep the change scoped.
**Examples of good task scope**:
- improve card hover/select states
- animate card draw (deck → hand)
- animate hand → play area
- animate play area → discard
- implement target selection & beam feedback
- improve turn transition
- implement action → target feedback
- refactor ActionVisualizer / extract GameCard

**Examples of bad task scope**:
- "Make the whole game more dynamic."
- "Redesign everything."
- "Improve all animations."
If the request is broad, break the work into coherent stages.

## Phase 7 — Verify In Browser
Run the actual application. Test the exact interaction.
Inspect:
- animation origin and destination, easing, duration, layout shifts, overlap, z-index, clipping, target alignment, rapid clicking, repeated events, final state, console errors.
For coordinate-dependent animation, test viewport resizing.
For responsive UI, test at least one narrower viewport.

## Phase 8 — Critique Your Own Result
Do not assume the first rendered result is acceptable. After observing it, answer:
- Does it look physically connected?
- Can I understand who acted?
- Can I understand who was targeted?
- Can I understand the outcome?
- Is any motion unnecessary or too slow?
- Is anything teleporting?
- Is there visual noise?
- Does it still match the Wish Boardgame Salon design language?
If not, revise.

---

## Motion Principles
Use motion to explain change.
- **Good**: card travels from hand to table.
- **Bad**: card disappears and table flashes gold.
- **Good**: target player reacts after an action reaches them.
- **Bad**: all players pulse at the same time.
- **Good**: turn emphasis transfers from player A to player B.
- **Bad**: a permanent glowing border appears with no transition.

## Motion Timing
Do not blindly apply one duration everywhere. Use approximate ranges as starting points only:
- Micro feedback: 100–180ms
- UI state transition: 160–280ms
- Card movement: 250–500ms
- Major game action: 400–900ms total sequence

Longer sequences must justify their duration. Gameplay must not feel blocked by decorative animation.

## Springs
Prefer controlled springs for physical objects.
Avoid extremely bouncy motion unless the object or theme warrants it.
The current visual identity is premium and restrained. Motion should generally feel:
- **weighted, smooth, deliberate, responsive** (rather than cartoony, rubbery, hyperactive).

## Game Action Template
When designing a card action, consider:
```
CARD SELECT → CARD LIFT / CONFIRM → CARD LEAVES HAND → CARD MOVES TO RESOLUTION AREA → TARGET BECOMES ACTIVE → ACTION CONNECTS TO TARGET → RESULT REACTION → CARD MOVES TO DISCARD → TABLE SETTLES → NEXT TURN
```
Not every card requires every step. Remove steps that do not communicate useful information.

## Forbidden Shortcuts
Do not solve interaction problems merely by adding:
- box-shadow
- animation: pulse
- scale(1.05)
- transition: all
- another modal / banner / text block
- arbitrary setTimeout

## Completion
A game UI task is complete only after:
1. code verification (`npm test`, `npm run build`)
2. browser interaction verification
3. visual self-review
Report concrete evidence.

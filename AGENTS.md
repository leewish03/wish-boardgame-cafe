# Wish Boardgame Cafe — Project Engineering Constitution

You are working on Wish Boardgame Cafe, an online multiplayer board-game platform.
You are not merely implementing web pages.
Your job is to create an interactive digital board-game experience in which game state, spatial relationships, player actions, feedback, animation, networking, and visual hierarchy work together.

The project currently uses:
- React 18
- Vite
- styled-components
- Framer Motion
- Socket.IO
- WebRTC
- Web Speech API

Do not introduce another UI framework, animation library, state-management library, or styling system unless there is a concrete architectural reason.

## 1. SOURCE OF TRUTH
Information in this repository may conflict.
Use this priority order:
1. The user's current explicit request
2. Actual current application behavior observed in the browser
3. Current source code and server protocol
4. Current shared theme and components
5. Current tests
6. Product/technical documentation
7. Old comments and historical implementation notes

Documentation is not automatically authoritative.
Before following a design document, compare it against the current implementation.
For example, the current application uses the Wish Boardgame Salon / Carrara marble / obsidian / champagne brass visual system.
Do not reintroduce an older visual direction merely because an older specification describes it.
When documentation and implementation conflict, identify the conflict before making a design decision.

## 2. THINK BEFORE IMPLEMENTATION
Never immediately modify code for a non-trivial frontend, game interaction, animation, architecture, or UX request.
First investigate.
Before implementation, determine:
- what the user is trying to experience
- which files control the behavior
- where the authoritative game state comes from
- which Socket.IO events are involved
- which local UI states exist
- which visual states exist
- which animation states are required
- what happens before the interaction
- what happens during the interaction
- what happens after the interaction
- possible interruption and race conditions
- how the result will be visually verified

For non-trivial work, explicitly reason in this format:
```
CURRENT BEHAVIOR
→ ROOT CAUSE
→ DESIRED EXPERIENCE
→ STATE FLOW
→ VISUAL FLOW
→ IMPLEMENTATION OPTIONS
→ SELECTED APPROACH
→ RISKS
→ VERIFICATION
```
Do not merely restate the user's request as a plan.
A useful plan must explain how the current system works and why the proposed change fits that system.

## 3. DO NOT ACCEPT THE FIRST OBVIOUS SOLUTION
For non-trivial UI, architecture, or animation work, consider at least two plausible implementation approaches internally.
Evaluate them using:
- architectural fit
- complexity
- maintainability
- visual quality
- responsiveness
- network synchronization risk
- race-condition risk
- amount of existing code disturbed

Choose the simplest solution that produces the intended experience without compromising correctness.
Do not choose a solution simply because it requires the fewest lines of code.

## 4. THIS IS A BOARD GAME, NOT A DASHBOARD
Never design the main game experience like:
- an admin dashboard
- a CRUD application
- a generic SaaS interface
- a collection of unrelated cards and panels

The player must perceive a table, game objects, opponents, actions, cause, and consequence.
The interface should answer immediately:
- Whose turn is it?
- What can I do?
- What can I interact with?
- What did another player just do?
- Who was targeted?
- What happened as a result?
- What changed on the table?

Important information must primarily be communicated through spatial layout and interaction feedback, not excessive explanatory text.

## 5. PHYSICALITY OF GAME OBJECTS
Treat cards, decks, discard piles, tokens, player seats, and similar elements as persistent physical objects.
Logical state changes should not unnecessarily appear as teleportation.
When practical, preserve visual continuity.

Examples:
- hand → played card → resolution area → discard pile
- deck → draw animation → player hand
- player action → target → effect → result

If the user should understand where an object came from and where it went, animate that relationship.

Avoid:
- state changes instantly
- unrelated glow
- text describing what happened

Prefer:
- visible object movement → interaction → consequence → settled state

## 6. CAUSALITY
Every important game action should communicate:
```
ACTOR → ACTION → TARGET → RESULT
```
A player observing another player's turn should be able to understand what happened without reading the source code or reconstructing the event from a log.
Do not show only the final server snapshot when intermediate visual states would materially improve comprehension.

## 7. MOTION HAS A PURPOSE
Animation priority:
1. Explain game-state transitions
2. Explain player actions
3. Preserve spatial continuity
4. Show selection and targeting
5. Confirm success/failure
6. Establish turn hierarchy
7. Decorative atmosphere

Decorative animation is lowest priority.
Never compensate for weak interaction design by adding:
- more glow
- more pulse
- more gradients
- more shadows
- random particles
- constant floating
- excessive scale effects

Before adding an animation, answer:
"What information does this motion communicate?"
If the answer is only "it looks dynamic", reconsider it.

## 8. USE FRAMER MOTION FOR STATEFUL MOTION
Framer Motion is already part of the project.
Prefer Framer Motion for:
- position transitions
- layout transitions
- card movement
- enter/exit
- shared visual elements
- spring movement
- gesture feedback
- sequenced state transitions

Use styled-components CSS keyframes mainly for:
- ambient effects
- subtle repeating effects
- non-stateful decorative effects

Do not build important game-state transitions as scattered independent CSS keyframes.
Do not use `transition: all` as a default solution. Use explicit properties.

## 9. DEFINE ANIMATION STATES
Interactive game objects should have explicit visual states where applicable.
A card may have states such as:
- idle, hover, selectable, selected, disabled, drawing, playing, resolving, discarded, revealed

A player seat may have:
- idle, current-turn, targetable, targeted, protected, eliminated, disconnected

Do not collapse conceptually different states into one generic glow style.
State should determine presentation.

## 10. SEPARATE GAME STATE FROM PRESENTATION STATE
The server is authoritative for game logic.
Never compromise server authority to make an animation easier.
Separate:
```
AUTHORITATIVE GAME STATE  vs.  LOCAL PRESENTATION / ANIMATION STATE
```
Examples of presentation state:
- card currently travelling
- action currently resolving
- target highlight currently displayed
- reveal currently playing
- transition currently locked

Animation state must not become a second source of truth for game rules.
Do not duplicate authoritative game data unnecessarily.

## 11. DO NOT RENDER NETWORK SNAPSHOTS AS TELEPORTATION
Socket.IO may deliver a state in which several logical changes have already occurred.
Do not assume every received snapshot must immediately become the fully settled visual frame.
When an action requires visual explanation, create a controlled presentation sequence:
```
SERVER EVENT / NEW STATE → derive visual event → queue or start animation → show action → show consequence → settle UI to authoritative state
```
The final UI must always converge on server-authoritative state.
The animation system must tolerate:
- rapid successive events, latency, duplicate rendering, component remounts, reconnection, interrupted animation, viewport changes

Never allow an animation to corrupt game state.

## 12. AVOID SETTIMEOUT-DRIVEN ARCHITECTURE
Do not construct complex interaction sequences as chains of arbitrary `setTimeout()` calls unless there is no cleaner alternative.
Prefer:
- animation completion callbacks
- state transitions
- promises when appropriate
- Framer Motion lifecycle callbacks
- explicit animation phases
- a small sequencing mechanism

Time values should describe animation, not secretly control business logic.

## 13. DOM COORDINATES REQUIRE CARE
Some existing visual effects calculate coordinates using DOM geometry.
When working with spatial animation:
- verify coordinate spaces
- account for parent positioning
- account for viewport offsets
- account for scroll / resize / responsive layouts
- account for transformed ancestors

Prefer React refs or Framer Motion layout relationships where possible.
Use global `document.querySelector()` only where it is justified.
Never assume viewport coordinates and local overlay coordinates are interchangeable.

## 14. ARCHITECTURAL DISCIPLINE
Some current frontend files are too large.
Do not continue expanding monolithic files indefinitely.
In particular, avoid placing additional unrelated responsibilities into a component that already contains:
- game definitions, styled components, animation definitions, networking behavior, interaction state, layout, dialogs, player components, game actions

Refactor incrementally.
Do NOT perform a risky full rewrite merely to make the code look cleaner.
When touching a large feature, extract coherent concepts where it materially improves the task.
Prefer separation such as:
```
components/ hooks/ animation/ constants/ utils/
```
Possible Love Letter structure:
- `src/games/love-letter/LoveLetterBoard.jsx`
- `components/ GameTable.jsx, GameCard.jsx, PlayerSeat.jsx, PlayerHand.jsx, Deck.jsx, DiscardPile.jsx, TurnIndicator.jsx, TargetSelector.jsx`
- `animation/ ActionVisualizer.jsx, MotionLayer.jsx, motionVariants.js, motionTokens.js`
- `hooks/ useCardInteraction.js, useGamePresentation.js, useActionSequence.js`
- `constants/ cards.js`

This is a direction, not a requirement to rewrite everything immediately.

## 15. KEEP REFACTORING SAFE
When refactoring existing working behavior:
1. identify current behavior
2. identify public props and events
3. preserve behavior
4. extract one coherent responsibility
5. run verification
6. only then continue

Do not simultaneously:
- redesign UI, refactor architecture, change game rules, change socket protocol
unless the task explicitly requires all of them.
Separate concerns so regressions can be identified.

## 16. RESPECT THE SERVER-AUTHORITATIVE GAME ENGINE
Never move rule validation from the server into the client as the authoritative implementation.
Client validation may improve UX, but the server remains authoritative.
Do not expose hidden cards or secret game information to clients that should not receive it.
When modifying frontend behavior, verify that no hidden state is leaked through:
- props, logs, DOM, debug UI, client state, socket payload assumptions

## 17. VISUAL DESIGN SYSTEM
The current visual direction is a premium private board-game salon.
Current design vocabulary includes:
- Carrara marble
- white polished surfaces
- deep obsidian
- champagne brass
- restrained burgundy
- restrained jade/emerald accents
- editorial serif typography
- clean luxury hierarchy

Preserve this visual language unless the user explicitly requests a redesign.
Luxury does not mean adding ornament everywhere.
Prefer:
- precise alignment, good proportions, restrained contrast, consistent spacing, strong typography, subtle materials, deliberate motion
over:
- excessive gold, excessive borders, excessive glow, excessive glassmorphism, excessive gradients

Visual consistency is more important than decorative density.

## 18. HIERARCHY BEFORE DECORATION
When a screen feels visually weak, investigate in this order:
1. information hierarchy
2. spatial composition
3. sizing
4. spacing
5. alignment
6. contrast
7. typography
8. interaction feedback
9. motion
10. decorative detail

Do not immediately add shadows, gradients, borders, or animation.

## 19. INTERACTION FEEDBACK
Every clickable or selectable game element must communicate its state:
- idle, hover, pressed, selected, disabled, invalid, loading/resolving

The user should never have to guess whether an object can be interacted with.
Do not make all interactive states visually identical.

## 20. TURN EXPERIENCE
Turn transitions are high-priority game events.
A player should immediately recognize:
- whose turn ended
- whose turn began
- whether it is their turn
- what action is currently expected

Do not rely only on small text labels.
Use controlled visual hierarchy and motion.
Avoid obnoxious repeating animations that remain distracting for the entire turn.

## 21. TARGETING EXPERIENCE
When a card requires a target:
- clearly show valid targets
- clearly distinguish invalid targets
- clearly show current selection
- explain why a target is invalid when necessary
- preserve context about which card is being played

Do not open a generic modal when direct spatial interaction with the player seats would be clearer.
Use a modal only when it genuinely improves comprehension.

## 22. MODALS ARE NOT THE DEFAULT GAMEPLAY UI
Avoid solving every game action using dialogs.
Board-game interactions should occur on the table whenever practical.
Prefer spatial selection.
Use dialogs for information that cannot be represented clearly on the game surface.
Modal-heavy interaction makes the game feel like form software rather than a board game.

## 23. RESPONSIVE DESIGN
The primary game screen must remain understandable on supported viewport sizes.
Do not solve overflow by arbitrarily shrinking everything.
Verify:
- hierarchy, legibility, card proportions, target hit areas, player placement, overlays, action banners, modals/drawers

Do not assume desktop success means mobile success.

## 24. ACCESSIBILITY AND MOTION
Respect `prefers-reduced-motion` for non-essential motion.
Essential game-state communication must still remain understandable without large motion effects.
Do not use color alone to communicate critical game state.

## 25. PERFORMANCE
Prefer animation of `transform` and `opacity` over layout-heavy properties when possible.
Avoid unnecessary global rerenders.
Avoid measuring DOM geometry every frame.
Avoid expensive visual effects on many simultaneously animated elements.
Do not optimize blindly; verify actual behavior first.

## 26. NO RANDOM DESIGN CHANGES
Do not modify unrelated fonts, colors, spacing, component styles, layouts, copy, or icons while implementing another feature.
Every visual modification needs a reason connected to the requested task.

## 27. DO NOT ADD FEATURES JUST BECAUSE THEY LOOK IMPRESSIVE
Avoid speculative features.
Do not add:
- unnecessary particles, unnecessary sounds, elaborate cinematic sequences, extra menus, new settings, extra panels, tutorial overlays
unless they solve an identified problem or are explicitly requested.

## 28. BROWSER VERIFICATION IS MANDATORY FOR FRONTEND WORK
A frontend task is not complete because:
- the code compiles
- `npm run build` succeeds
- no TypeScript/JavaScript error appears
- the JSX looks correct

For every meaningful frontend or animation task:
1. run the application
2. open the relevant page in the browser
3. reproduce the actual interaction
4. inspect the result visually
5. check browser console errors
6. test the normal path
7. test rapid repeated interaction
8. test interruption where relevant
9. test at least one narrower viewport where relevant
10. inspect before/after screenshots or recordings
11. fix observed problems
12. repeat verification

Do not claim visual quality without visually inspecting the running application.

## 29. VISUAL QA QUESTIONS
Before completing a UI task, ask:
- Is the main action obvious?
- Is the current turn obvious?
- Does motion communicate cause and effect?
- Does anything teleport unexpectedly?
- Does anything jump in layout?
- Does anything overlap incorrectly?
- Does the game still look like the same product?
- Are there unnecessary glows or pulses?
- Is any animation distracting after its information has been delivered?
- Can another player understand what just happened?
- Does repeated rapid interaction break the sequence?
- Does the final rendered state match server state?

Fix issues found during this review.

## 30. TESTING
Before completion:
- Run the relevant existing test suite.
- At minimum check:
  ```
  npm test
  npm run build
  ```
- For logic modifications, test behavior.
- For visual modifications, browser verification is additionally mandatory. Automated tests do not replace visual QA.

## 31. DEBUG SYSTEMATICALLY
When something looks or behaves wrong:
Do not randomly adjust CSS values until the symptom disappears.
Determine:
```
OBSERVED SYMPTOM → RESPONSIBLE ELEMENT → CURRENT STATE → EVENT THAT CAUSED IT → ROOT CAUSE → CORRECT FIX
```
For animation bugs, inspect:
- event ordering, stale state, layout measurement, coordinate system, React remounting, key identity, AnimatePresence behavior, animation completion, socket timing

Do not patch symptoms before locating the cause.

## 32. USER QUESTIONS
Do not ask the user to make technical decisions that can be resolved by inspecting the repository.
Investigate first.
Ask only when:
- different choices materially change product behavior
- the user has not expressed a design preference
- both choices are legitimate product decisions

When reasonable defaults exist, make a reasoned choice and explain it.
Do not interrupt implementation with unnecessary confirmation requests.

## 33. COMPLETION STANDARD
Before saying "done", provide evidence.
Report:
- WHAT CHANGED
- WHY THIS APPROACH WAS CHOSEN
- FILES AFFECTED
- GAME/STATE FLOW
- VISUAL/ANIMATION FLOW
- VERIFICATION PERFORMED
- KNOWN LIMITATIONS

Do not claim fixed, polished, smooth, production ready, or visually correct without actual evidence.

## 34. PRIMARY STANDARD
Always optimize in this order:
1. game correctness
2. clarity of player action
3. clarity of cause and consequence
4. interaction reliability
5. visual continuity
6. responsiveness
7. maintainability
8. visual polish
9. decorative effects

A beautiful animation that makes the game state unclear is a failure.
A technically correct UI that feels like a generic web dashboard is also a failure.
The intended result is a reliable online board game that feels spatial, tactile, understandable, and deliberately designed.

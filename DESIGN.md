# Wish Boardgame Salon design contract

Extracted from the current shared theme and the running 390 x 844 game tables on 2026-10-14.
The project constitution takes precedence over external design references.

## 1. Atmosphere & identity

Carrara marble table, obsidian controls, champagne brass edges and burgundy card backs.
Opponents sit above the public table; the player's hand and decisions stay at the bottom.
Movement communicates a physical card's origin, target and destination.

## 2. Color

Use `THEME` in `src/shared/theme.js`: background #f4f6f8, surfaceCard #ffffff,
foreground/primary #090d16, mutedForeground #64748b, border #e2e8f0,
gold #c5a059, goldAntique #9a7b38, burgundy #631326, emerald #047857,
destructive #9f1239. Existing card artwork retains its printed palette.
The salon currently has one light material theme; system dark preference must not invert cards.

## 3. Typography

Existing serif: Cinzel/Noto Serif KR; display: Cormorant Garamond/Noto Serif KR;
body: Pretendard/system sans; numeric timing uses tabular figures.
New shared interaction tokens: caption 12px, body 14px, control 14px.
Small decorative card marks may remain smaller; actionable instructions and player names must be readable.

## 4. Spacing & layout

Shared interaction tokens: touch target 44px, gap 8px, panel padding 12px.
Phone baseline 390 x 844; also verify 320px width, short landscape, 768px and desktop.
Game viewport remains bounded; hand rails own horizontal scrolling, drawers/results own vertical scrolling.
Account for bottom safe-area inset. The central table yields space before controls become unreadable.
Dalmuti grouped hand cards: 72 x 100px baseline; 64 x 84px in short viewports.
The hand's grouped counts remain visible when input is disabled for another player's turn.

## 5. Components

- Shared `GameHud`: round metadata, live turn status, clock, connection and 44px menu button.
  On phones, status gets its own row so actor/action text is not truncated by metadata.
- Love Letter `GameCard`: native button for a selectable card, selected/locked/waiting states,
  keyboard activation, visible focus, ordinary touch scrolling when drag is disabled.
- Dalmuti rank stack: native pressed button, rank/name/count, legal/selected/waiting states.
  Distinguish selected cards by displacement and pressed state as well as color.
- Dalmuti results: ranking, host-only next round/rematch, lobby exit and inline request failure.
  Result and menu content remain scrollable at short heights; close is explicitly labeled.
- Existing shared Button/Dialog/RoomChat and game card artwork remain the reusable component layer.

## 6. Motion & interaction

Existing `MOTION_TOKENS`: micro 150ms, UI 220ms, card flight 380ms, settle 250ms.
Preserve service event batches, version guards and completion acknowledgements.
Reduced motion removes card lift/scale; state, labels and completion still communicate the action.
Request submission locks immediately; server rejection restores actionable controls and shows its reason.
New matches must retain monotonically increasing room versions so clients accept the opening batch.

## 7. Depth & surface

Keep existing mixed material treatment: marble surfaces, thin brass detail, restrained shadows.
Use THEME radius sm/md/lg/xl = 4/6/10/14px and the existing marbleSlab shadow.
Do not add ambient particles, permanent pulses or a different visual identity.

## 8. Accessibility constraints & verification debt

Native keyboard controls, visible focus, named close/menu actions, 44px primary touch targets,
readable errors and reduced-motion support are requirements for changed controls.
Existing small labels and modal focus handling require per-surface checks; this document is not a compliance certification.
No user-accepted debt or production readiness claim is recorded. Browser and server evidence belongs in the QA report.

## 9. New game tables (2026-10-15)

The existing salon surrounds three distinct physical tables. Six Nimmt uses ivory linen,
burgundy card backs, brass bullhead counters and four persistent card rows. Whitechapel
uses an aged-paper case map with burgundy evidence pins; Whitehall uses cooler parchment,
teal water and copper route marks. These are game-specific materials within the salon,
not a replacement app theme. Original generated cover assets live in public/assets/new-games/.
They decorate catalog/header surfaces only; maps, cards, tokens, paths and actions are live components.

New shared game tokens: parchment #efe5cf, parchmentInk #302b24, mapRoad #a99a7d,
river #b9cdd0, riverInk #315c64, caseRed #8c3439, policeBlue #345d8e,
policeYellow #a27b24, policeRed #a93e3e. Use existing THEME for outer controls/text/materials.
Cards use 68x94 desktop and 52x76 phone; row rails retain five slots plus the incoming sixth.
Card faces show a large number and a distinct bullhead count, not color alone.

Map play uses an SVG spatial graph with numbered places, crossing marks, textured blocks,
and persistent physical pawns. Pan/zoom is essential for 189/195-place boards: expose zoom,
fit and focus-active controls, plus a keyboard/touch-accessible list of legal nearby targets.
Map viewport owns panning; the contextual action tray owns scrolling. Never shrink labels
to make the entire map readable at phone width; focus and zoom preserve local detail.
Secret routes render only from the receiving role's authorized private view.

New shared primitives: TableShell (metadata/connection/menu), ActionTray (current actor,
selected action and confirmation), MapViewport (pan/zoom + explicit control alternatives),
RuleSheet (context-sensitive base rules), ResultSheet (winner/score/next round/rematch/leave).
Native 44px actions, focus-visible rings and disabled reasons apply. Korean labels use
word-break: keep-all; action labels never truncate the required decision.

Motion: Nimmt commitment hand->face-down seat, simultaneous reveal, ascending queue->row,
full row->actor penalty pile, settled scores. Hidden-movement games show public pawns
travelling along actual roads, search token->number->hit/miss, arrest result and night/leg
transition. Never show Jack's route to detectives. Completion acknowledges a versioned
presentation batch; reduced motion provides the same phases with short fades/static marks.
No permanent pulse, unrelated particles, or modal-only gameplay.

## 10. Screen direction and available space

All five games expose the same 44px screen-control button in the existing header.
Its native dialog offers automatic orientation, portrait, landscape and fullscreen.
Only an explicit click requests browser fullscreen/orientation; rejected locks explain
that the device must be rotated. Exit/unmount releases locks owned by this control.
Changing direction must not remount the table or reset a pending action.

Use the bounded scroll-body-shell pattern described at
https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/scroll-body-shell.md.
Hidden-movement portrait layout reserves at most 34% for the independently scrolling
action tray; landscape at widths of at least 600px places a 240–330px tray beside the map.
The map flexes with min-height:0; header/status/notices remain bounded and safe-area aware.
Short landscape removes cover art and compresses metadata, without shrinking 44px controls.
Card tables keep their hand rails and action controls reachable in both orientations.

## 11. Five-game interaction quality goal (2026-10-15)

Preserve sections 1–10 as the established contract. The active implementation plan is
`.omo/plans/all-games-release-quality.md`; evidence is under `.omo/evidence/all-games-quality/`.

Map actions use one scroll body with persistent turn heading and selection/confirm footer.
Selection is separate from camera navigation. Coach and ordered double-crime choices expose
first place → second place → preview → confirm, with undo before submission. Setup preselects
only forced locations; meaningful secret identities remain the player's choice. Police pieces
can be selected spatially as well as through named controls. Gestures preserve zoom anchors
and cancel on interruption; dense nodes retain numbered alternatives.

Love Letter confirmation belongs beside the hand and remains reachable in short landscape.
Closing the guess dialog preserves the selected card. The dialog traps focus, supports Escape,
returns focus and honors reduced motion. Dalmuti separates standalone jokers from explicit
mixed compositions; merchant target selection precedes confirmation. Six Nimmt uses the whole
row as a selectable target and previews its penalty before confirmation.

Use existing motion tokens for card pipelines; map piece travel stays within 250–650ms.
Every important motion shows actor, action, target and consequence, while final state converges
to the authoritative server version. Keep original thematic assets and live game objects.
No new framework, broad rewrite, ambient particle layer or global palette change.

Verification covers all five games, normal complete matches, interruption, keyboard and
portrait/landscape viewports. Browser emulation does not certify physical touchscreen/pinch
or OS orientation behavior. No AAA or release-readiness claim until recorded criteria pass.

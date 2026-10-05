// Presentation owns only the frames between authoritative snapshots.
export function createPresentationState() {
  return { latest: null, display: null, batches: new Map(), queue: [], current: null, seen: new Set(), settledVersion: -1, generation: 0 };
}

export function synchronizePresentation(model, room) {
  model.latest = room; model.display = room;
  model.batches.clear(); model.queue = []; model.current = null;
  model.settledVersion = room?.stateVersion ?? -1;
  model.generation += 1;
}

export function enqueuePresentation(model, envelope) {
  if (!envelope?.eventId || envelope.stateVersion <= model.settledVersion || model.seen.has(envelope.eventId)) return;
  model.seen.add(envelope.eventId);
  if (model.seen.size > 512) model.seen.delete(model.seen.values().next().value);
  const batch = model.batches.get(envelope.stateVersion) || new Map();
  batch.set(envelope.eventIndex ?? 0, envelope);
  model.batches.set(envelope.stateVersion, batch);
  const size = envelope.eventCount || 1;
  if (batch.size === size && Array.from({ length: size }, (_, i) => batch.has(i)).every(Boolean)) {
    model.queue.push(...[...batch.values()].sort((a, b) => a.eventIndex - b.eventIndex));
    model.queue.sort((a, b) => a.stateVersion - b.stateVersion || a.eventIndex - b.eventIndex);
    model.batches.delete(envelope.stateVersion);
  }
  beginPresentation(model);
}

export function observePresentation(model, room) {
  if (!room?.dalmuti || (model.latest && room.stateVersion < model.latest.stateVersion)) return;
  if (!model.display) { synchronizePresentation(model, room); return; }
  const waitingVersion = model.current?.stateVersion ?? model.queue[0]?.stateVersion ?? Math.min(...model.batches.keys());
  if (room.stateVersion < waitingVersion && waitingVersion !== Infinity) return;
  model.latest = room;
  if (!room.presentationPending || room.isPaused) {
    synchronizePresentation(model, room);
    return;
  }
  beginPresentation(model);
}

function updateFrame(model, change) {
  const room = model.display;
  if (!room?.dalmuti) return;
  const game = { ...room.dalmuti, players: room.dalmuti.players.map((player) => ({ ...player })), trick: { ...room.dalmuti.trick } };
  change(game);
  model.display = { ...room, dalmuti: game, players: game.players };
}

function beginPresentation(model) {
  if (model.current || !model.latest || !model.queue.length || model.queue[0].stateVersion > model.latest.stateVersion) return;
  const envelope = model.queue.shift();
  model.current = { ...envelope, generation: model.generation };
  const event = envelope.event;
  if (event.type === 'ROUND_DEALT') {
    const game = model.latest.dalmuti;
    model.display = { ...model.latest, mySecret: { ...model.latest.mySecret, hand: [] }, dalmuti: { ...game, playPhase: 'DEALING', matchState: 'PLAYING', currentTurnPlayerId: null, outcome: null, trick: { ...game.trick, sets: [], requiredCount: null, topRank: null, passPlayerIds: [] } } };
  } else if (event.type === 'GREAT_REVOLUTION') {
    updateFrame(model, (game) => {
      game.hierarchy = [...event.hierarchy];
      game.players = model.latest.dalmuti.players.map((player) => ({ ...player }));
    });
  } else if (event.type === 'PASSED') {
    updateFrame(model, (game) => {
      const player = game.players.find((candidate) => candidate.id === event.actorId);
      if (player) player.passed = true;
    });
  } else if (event.type === 'ROUND_ENDED' || event.type === 'MATCH_ENDED') {
    model.display = model.latest;
  }
}

export function completePresentation(model, eventId, generation) {
  const current = model.current;
  if (!current || current.eventId !== eventId || current.generation !== generation) return null;
  const event = current.event;
  if (event.type === 'ROUND_DEALT') model.display = { ...model.display, mySecret: model.latest.mySecret };
  if (event.type === 'SET_PLAYED') updateFrame(model, (game) => {
    game.trick.sets = [...game.trick.sets.filter((set) => set.id !== event.id), event];
    game.trick.requiredCount = event.count; game.trick.topRank = event.rank; game.trick.lastPlayerId = event.actorId;
    game.trick.passPlayerIds = [];
    game.players.forEach((player) => { player.passed = false; });
    const actor = game.players.find((player) => player.id === event.actorId);
    if (actor) { actor.handCount = event.handCount; if (!event.handCount) actor.finishedPosition = game.players.filter((player) => player.finishedPosition).length + 1; }
    game.currentTurnPlayerId = null;
  });
  if (event.type === 'TRICK_CLEARED') updateFrame(model, (game) => {
    game.trick = { ...game.trick, sets: [], requiredCount: null, topRank: null, passPlayerIds: [], completedCount: game.trick.completedCount + 1 };
    game.players.forEach((player) => { player.passed = false; });
  });
  const last = (current.eventIndex ?? 0) === (current.eventCount || 1) - 1;
  model.current = null;
  if (last) {
    model.settledVersion = current.stateVersion;
    model.display = model.latest;
  }
  beginPresentation(model);
  return last ? current.eventId : null;
}

export function toggleTaxSelection(selection, rank, available, needed) {
  const current = selection[rank] || 0;
  const total = Object.values(selection).reduce((sum, count) => sum + count, 0);
  const next = current >= available || (current > 0 && total >= needed) ? 0 : current + 1;
  return total - current + next > needed ? selection : { ...selection, [rank]: next };
}

export function visibleSetRanks(set) {
  const jesters = Math.min(set.jesterCount || 0, 6);
  const natural = Math.min(set.count - (set.jesterCount || 0), 6 - jesters);
  return [...Array(natural).fill(set.rank), ...Array(jesters).fill(13)];
}

export function anchorPoint(element, surface, width = surface?.width, height = surface?.height) {
  if (!element || !surface || !surface.width || !surface.height) return null;
  return { x: (element.left + element.width / 2 - surface.left) * width / surface.width, y: (element.top + element.height / 2 - surface.top) * height / surface.height };
}

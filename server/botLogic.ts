import type { GameState } from '../src/game/gameState';
import * as gameEngine from '../src/game/gameEngine';

export type BotDifficulty = 'easy' | 'medium';

export function makeBotMove(state: GameState, botPlayerId: string, difficulty: BotDifficulty): GameState {
  if (difficulty === 'easy') return makeEasyMove(state, botPlayerId);
  return makeMediumMove(state, botPlayerId);
}

// ─── Shared: Setup Phase Move ───────────────────────────────
function makeSetupMove(state: GameState, playerId: string, smartPicks = false): GameState {
  const expectedCount = state.turnPhase === 'SETUP_ROUND_1' ? 1 : 2;
  const playerSettlements = Object.values(state.buildings).filter(b => b.playerId === playerId).length;
  const playerRoads = Object.values(state.roads).filter(r => r === playerId).length;
  let newState = state;

  if (playerSettlements < expectedCount) {
    const validNodes = state.board!.graph.nodes.filter(n => {
      if (newState.buildings[n.id]) return false;
      const edges = state.board!.graph.edges.filter(e => e.node1.id === n.id || e.node2.id === n.id);
      const adjNodeIds = edges.map(e => e.node1.id === n.id ? e.node2.id : e.node1.id);
      return !adjNodeIds.some(adj => newState.buildings[adj]);
    });

    if (validNodes.length > 0) {
      let pick = validNodes[Math.floor(Math.random() * validNodes.length)];
      if (smartPicks) {
        // Score each node by productive adjacent hexes (with number tokens, not desert)
        const scored = validNodes.map(n => ({
          n,
          score: n.adjacentHexes.filter(hexId => {
            const h = state.board!.hexes.find(h => h.id === hexId);
            return h && h.resource !== 'desert' && h.numberToken;
          }).length
        })).sort((a, b) => b.score - a.score);
        pick = scored[0].n;
      }
      newState = gameEngine.buildSettlement(newState, pick.id, playerId);
    }
  }

  if (playerRoads < expectedCount) {
    const mySettlements = Object.entries(newState.buildings)
      .filter(([_, b]) => b.playerId === playerId)
      .map(([id]) => id);
    const validEdges = state.board!.graph.edges.filter(e =>
      !newState.roads[e.id] && (mySettlements.includes(e.node1.id) || mySettlements.includes(e.node2.id))
    );
    if (validEdges.length > 0) {
      const pick = validEdges[Math.floor(Math.random() * validEdges.length)];
      newState = gameEngine.buildRoad(newState, pick.id, playerId);
    }
  }

  const afterEnd = gameEngine.endTurn(newState);
  return afterEnd !== newState ? afterEnd : newState;
}

// ─── Easy Bot: Purely random valid moves ───────────────────
function makeEasyMove(state: GameState, playerId: string): GameState {
  const phase = state.turnPhase;

  if (phase === 'SETUP_ROUND_1' || phase === 'SETUP_ROUND_2') {
    return makeSetupMove(state, playerId, false);
  }

  if (phase === 'ROLL') {
    const afterRoll = gameEngine.rollDice(state);
    if (afterRoll !== state) return afterRoll;
    return state;
  }

  if (phase === 'ROBBER_MOVE') {
    const validHexes = state.board!.hexes.filter(h => h.id !== state.robberHexId);
    if (validHexes.length > 0) {
      const pick = validHexes[Math.floor(Math.random() * validHexes.length)];
      return gameEngine.moveRobber(state, pick.id, null, playerId);
    }
    return state;
  }

  if (phase === 'TRADE_BUILD') {
    return gameEngine.endTurn(state);
  }

  return state;
}

// ─── Medium Bot: Strategic moves ───────────────────────────
function makeMediumMove(state: GameState, playerId: string): GameState {
  const phase = state.turnPhase;

  if (phase === 'SETUP_ROUND_1' || phase === 'SETUP_ROUND_2') {
    return makeSetupMove(state, playerId, true);
  }

  if (phase === 'ROLL') {
    return gameEngine.rollDice(state);
  }

  if (phase === 'ROBBER_MOVE') {
    // Try to block the opponent with the most VP
    const validHexes = state.board!.hexes.filter(h => h.id !== state.robberHexId);
    if (validHexes.length > 0) {
      // Find hex adjacent to opponents  
      const opponentIds = Object.keys(state.players).filter(p => p !== playerId);
      let bestHex = validHexes[0];
      for (const hex of validHexes) {
        const adjNodes = state.board!.graph.nodes.filter(n => n.adjacentHexes.includes(hex.id));
        const hasOpponentBuilding = adjNodes.some(n => {
          const b = state.buildings[n.id];
          return b && opponentIds.includes(b.playerId);
        });
        if (hasOpponentBuilding) { bestHex = hex; break; }
      }
      const adjNodes = state.board!.graph.nodes.filter(n => n.adjacentHexes.includes(bestHex.id));
      const stealFrom = adjNodes
        .map(n => state.buildings[n.id]?.playerId)
        .filter(p => p && p !== playerId)[0] ?? null;
      return gameEngine.moveRobber(state, bestHex.id, stealFrom ?? null, playerId);
    }
    return state;
  }

  if (phase === 'TRADE_BUILD') {
    let newState = state;
    const player = () => newState.players[playerId];

    // Try to build settlement
    const validSettNodes = state.board!.graph.nodes.filter(n => {
      if (newState.buildings[n.id]) return false;
      const edges = state.board!.graph.edges.filter(e => e.node1.id === n.id || e.node2.id === n.id);
      const adjIds = edges.map(e => e.node1.id === n.id ? e.node2.id : e.node1.id);
      if (adjIds.some(adj => newState.buildings[adj])) return false;
      return edges.some(e => newState.roads[e.id] === playerId);
    });
    if (validSettNodes.length > 0) {
      const afterBuild = gameEngine.buildSettlement(newState, validSettNodes[0].id, playerId);
      if (afterBuild !== newState) newState = afterBuild;
    }

    // Try to build road
    const myBuildings = new Set(Object.entries(newState.buildings).filter(([_, b]) => b.playerId === playerId).map(([id]) => id));
    const myRoadNodes = new Set<string>();
    state.board!.graph.edges.filter(e => newState.roads[e.id] === playerId).forEach(e => {
      myRoadNodes.add(e.node1.id); myRoadNodes.add(e.node2.id);
    });
    myBuildings.forEach(id => myRoadNodes.add(id));

    const validRoadEdges = state.board!.graph.edges.filter(e => {
      if (newState.roads[e.id]) return false;
      const b1 = newState.buildings[e.node1.id];
      const b2 = newState.buildings[e.node2.id];
      const n1Blocked = b1 && b1.playerId !== playerId;
      const n2Blocked = b2 && b2.playerId !== playerId;
      return (!n1Blocked && myRoadNodes.has(e.node1.id)) || (!n2Blocked && myRoadNodes.has(e.node2.id));
    });
    if (validRoadEdges.length > 0) {
      const p = player();
      if (p.resources.wood >= 1 && p.resources.brick >= 1) {
        const afterRoad = gameEngine.buildRoad(newState, validRoadEdges[0].id, playerId);
        if (afterRoad !== newState) newState = afterRoad;
      }
    }

    return gameEngine.endTurn(newState);
  }

  return state;
}

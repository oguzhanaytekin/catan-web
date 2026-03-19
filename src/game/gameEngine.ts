import type { GameState, ResourceType } from './gameState';
import type { Intersection } from '../utils/mapGenerator';

export function distributeResources(state: GameState, roll: number): GameState {
  if (!state.board) return state;

  // We need to return a new state with updated player resources
  const newState = { ...state, players: { ...state.players } };
  
  // Clone players to be safe
  Object.keys(newState.players).forEach(id => {
    newState.players[id] = { ...newState.players[id], resources: { ...newState.players[id].resources } };
  });

  // Find hexes with the rolled number
  const matchingHexes = state.board.hexes.filter(h => h.numberToken === roll);

  for (const hex of matchingHexes) {
    if (hex.resource === 'desert' || hex.id === state.robberHexId) continue;
    
    // Find nodes adjacent to this hex
    const adjacentNodes: Intersection[] = state.board.graph.nodes.filter(n => n.adjacentHexes.includes(hex.id));
    
    for (const node of adjacentNodes) {
      const building = state.buildings[node.id];
      if (building && newState.players[building.playerId]) {
         const amount = building.type === 'city' ? 2 : 1;
         newState.players[building.playerId].resources[hex.resource] += amount;
      }
    }
  }

  return newState;
}

export function rollDice(state: GameState): GameState {
  if (state.turnPhase !== 'ROLL' || state.diceState.rolled) {
    return state; // Action not allowed
  }

  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const result = die1 + die2;

  let nextState: GameState = {
    ...state,
    diceState: {
      die1,
      die2,
      rolled: true
    },
    turnPhase: 'TRADE_BUILD'
  };

  if (result !== 7) {
    nextState = distributeResources(nextState, result);
  } else {
    nextState.turnPhase = 'ROBBER_MOVE';
    
    // Auto-discard half resources for those with > 7
    Object.keys(nextState.players).forEach(playerId => {
      const p = nextState.players[playerId];
      const totalResources = Object.values(p.resources).reduce((a, b) => a + b, 0);
      if (totalResources > 7) {
        const toDiscard = Math.floor(totalResources / 2);
        let discarded = 0;
        
        // Very basic simple random discard for prototype
        while (discarded < toDiscard) {
          const availableTypes = (Object.keys(p.resources) as ResourceType[]).filter(r => p.resources[r] > 0);
          if (availableTypes.length === 0) break;
          const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
          p.resources[randomType]--;
          discarded++;
        }
      }
    });
  }

  return nextState;
}

export function endTurn(state: GameState): GameState {
  if (state.turnPhase === 'SETUP_ROUND_1') {
    const playerId = state.turnOrder[state.currentTurnIndex];
    const playerSettlements = Object.values(state.buildings).filter(b => b.playerId === playerId).length;
    const playerRoads = Object.values(state.roads).filter(r => r === playerId).length;
    
    // Yolları ve köyleri kontrol et (1 köy, 1 yol zorunlu)
    if (playerSettlements < 1 || playerRoads < 1) return state;

    const nextIndex = state.currentTurnIndex + 1;
    if (nextIndex >= state.turnOrder.length) {
      return { ...state, turnPhase: 'SETUP_ROUND_2', currentTurnIndex: state.turnOrder.length - 1 };
    }
    return { ...state, currentTurnIndex: nextIndex };
  }

  if (state.turnPhase === 'SETUP_ROUND_2') {
    const playerId = state.turnOrder[state.currentTurnIndex];
    const playerSettlements = Object.values(state.buildings).filter(b => b.playerId === playerId).length;
    const playerRoads = Object.values(state.roads).filter(r => r === playerId).length;
    
    // Yolları ve köyleri kontrol et (2 köy, 2 yol toplamda zorunlu)
    if (playerSettlements < 2 || playerRoads < 2) return state;

    const nextIndex = state.currentTurnIndex - 1;
    if (nextIndex < 0) {
      return { ...state, turnPhase: 'ROLL', currentTurnIndex: 0 };
    }
    return { ...state, currentTurnIndex: nextIndex };
  }

  if (state.turnPhase !== 'TRADE_BUILD') {
    return state; // Must roll dice first
  }

  const nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;

  return {
    ...state,
    currentTurnIndex: nextIndex,
    turnPhase: 'ROLL',
    diceState: {
      die1: 1, 
      die2: 1,
      rolled: false
    }
  };
}

export function devBuildSettlement(state: GameState, nodeId: string, playerId: string): GameState {
  return {
    ...state,
    buildings: {
      ...state.buildings,
      [nodeId]: { playerId, type: 'settlement' }
    }
  };
}

// Helper to check if player can afford something
function canAfford(player: GameState['players'][string], cost: Record<string, number>): boolean {
  return (
    player.resources.wood >= cost.wood &&
    player.resources.brick >= cost.brick &&
    player.resources.wheat >= cost.wheat &&
    player.resources.sheep >= cost.sheep &&
    player.resources.ore >= cost.ore
  );
}

// Helper to subtract resources
function payCost(player: GameState['players'][string], cost: Record<string, number>) {
  return {
    ...player,
    resources: {
      wood: player.resources.wood - cost.wood,
      brick: player.resources.brick - cost.brick,
      wheat: player.resources.wheat - cost.wheat,
      sheep: player.resources.sheep - cost.sheep,
      ore: player.resources.ore - cost.ore,
    }
  };
}

import { BUILDING_COSTS } from './gameState';

// Helper to calculate longest road using DFS
function calculateLongestRoad(state: GameState, playerId: string): number {
  if (!state.board) return 0;
  
  // Find all edges owned by this player
  const playerEdges = state.board.graph.edges.filter(e => state.roads[e.id] === playerId);
  if (playerEdges.length === 0) return 0;

  // Build a fast adjacency list for the player's road network
  // Map: Node ID -> Array of connected Node IDs (only traversing player's paths)
  const network = new Map<string, string[]>();
  
  for (const edge of playerEdges) {
    if (!network.has(edge.node1.id)) network.set(edge.node1.id, []);
    if (!network.has(edge.node2.id)) network.set(edge.node2.id, []);
    
    // An enemy settlement/city breaks the path
    const b1 = state.buildings[edge.node1.id];
    const b2 = state.buildings[edge.node2.id];
    
    const node1Blocked = b1 && b1.playerId !== playerId;
    const node2Blocked = b2 && b2.playerId !== playerId;

    if (!node1Blocked) network.get(edge.node1.id)!.push(edge.node2.id);
    if (!node2Blocked) network.get(edge.node2.id)!.push(edge.node1.id);
  }

  let maxLength = 0;

  // Standard DFS to find longest simple path in a graph
  function dfs(currentNode: string, visitedEdges: Set<string>, currentLength: number) {
    maxLength = Math.max(maxLength, currentLength);
    
    const neighbors = network.get(currentNode) || [];
    for (const nextNode of neighbors) {
      const edgeId = playerEdges.find(e => 
        (e.node1.id === currentNode && e.node2.id === nextNode) ||
        (e.node2.id === currentNode && e.node1.id === nextNode)
      )?.id;

      if (edgeId && !visitedEdges.has(edgeId)) {
        visitedEdges.add(edgeId);
        dfs(nextNode, visitedEdges, currentLength + 1);
        visitedEdges.delete(edgeId); // Backtrack
      }
    }
  }

  // Start DFS from every node in the player's network
  for (const startNode of network.keys()) {
    dfs(startNode, new Set(), 0);
  }

  return maxLength;
}

export function buildRoad(state: GameState, edgeId: string, playerId: string): GameState {
  const isSetup = state.turnPhase === 'SETUP_ROUND_1' || state.turnPhase === 'SETUP_ROUND_2';
  if (!isSetup && state.turnPhase !== 'TRADE_BUILD') return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  if (state.roads[edgeId]) return state; // Already built
  
  const player = state.players[playerId];
  if (!isSetup && !canAfford(player, BUILDING_COSTS.road)) return state;

  if (isSetup) {
    const playerRoads = Object.values(state.roads).filter(ownerId => ownerId === playerId).length;
    if (state.turnPhase === 'SETUP_ROUND_1' && playerRoads >= 1) return state;
    if (state.turnPhase === 'SETUP_ROUND_2' && playerRoads >= 2) return state;
  }

  if (!state.board) return state;

  // Connection Rule Check
  const edge = state.board.graph.edges.find(e => e.id === edgeId);
  if (!edge) return state;

  const node1Id = edge.node1.id;
  const node2Id = edge.node2.id;

  const building1 = state.buildings[node1Id];
  const building2 = state.buildings[node2Id];

  const ownsBuilding1 = building1?.playerId === playerId;
  const ownsBuilding2 = building2?.playerId === playerId;

  let isConnected = false;

  if (isSetup) {
    // In setup, road must explicitly connect to one of your settlements
    isConnected = ownsBuilding1 || ownsBuilding2;
  } else {
    // Regular phase: connect to building OR an unblocked road
    if (ownsBuilding1 || ownsBuilding2) {
      isConnected = true;
    } else {
      const playerRoads = state.board.graph.edges.filter(e => state.roads[e.id] === playerId);
      
      const connectedViaNode1 = playerRoads.some(e => e.node1.id === node1Id || e.node2.id === node1Id);
      const connectedViaNode2 = playerRoads.some(e => e.node1.id === node2Id || e.node2.id === node2Id);

      // Enemy buildings block road connections through that node
      const node1Blocked = building1 && building1.playerId !== playerId;
      const node2Blocked = building2 && building2.playerId !== playerId;

      if ((connectedViaNode1 && !node1Blocked) || (connectedViaNode2 && !node2Blocked)) {
        isConnected = true;
      }
    }
  }

  if (!isConnected) return state;

  let newGameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: isSetup ? player : payCost(player, BUILDING_COSTS.road)
    },
    roads: {
      ...state.roads,
      [edgeId]: playerId
    }
  };

  // Re-calculate Longest Road
  const currentLength = calculateLongestRoad(newGameState, playerId);
  
  if (currentLength >= 5) {
    if (!newGameState.longestRoadPlayer) {
      newGameState.longestRoadPlayer = playerId;
      newGameState.players[playerId].victoryPoints += 2;
      newGameState.players[playerId].longestRoadAPI = true;
    } else if (newGameState.longestRoadPlayer !== playerId) {
      const currentHolderId = newGameState.longestRoadPlayer;
      const holderLength = calculateLongestRoad(newGameState, currentHolderId);
      
      if (currentLength > holderLength) {
        newGameState.longestRoadPlayer = playerId;
        newGameState.players[playerId].victoryPoints += 2;
        newGameState.players[playerId].longestRoadAPI = true;
        
        // Remove from old holder
        newGameState.players[currentHolderId] = {
          ...newGameState.players[currentHolderId],
          victoryPoints: newGameState.players[currentHolderId].victoryPoints - 2,
          longestRoadAPI: false
        };
      }
    }
  }

  return newGameState;
}

export function buildSettlement(state: GameState, nodeId: string, playerId: string): GameState {
  const isSetup = state.turnPhase === 'SETUP_ROUND_1' || state.turnPhase === 'SETUP_ROUND_2';
  if (!isSetup && state.turnPhase !== 'TRADE_BUILD') return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  if (!state.board) return state;
  if (state.buildings[nodeId]) return state; // Already built

  const player = state.players[playerId];
  if (!isSetup && !canAfford(player, BUILDING_COSTS.settlement)) return state;

  if (isSetup) {
    const playerSettlements = Object.values(state.buildings).filter(b => b.playerId === playerId).length;
    if (state.turnPhase === 'SETUP_ROUND_1' && playerSettlements >= 1) return state;
    if (state.turnPhase === 'SETUP_ROUND_2' && playerSettlements >= 2) return state;
  }

  // Distance Rule Check
  const connectedEdges = state.board.graph.edges.filter(e => e.node1.id === nodeId || e.node2.id === nodeId);
  const adjacentNodeIds = connectedEdges.map(e => e.node1.id === nodeId ? e.node2.id : e.node1.id);
  const distanceRuleViolated = adjacentNodeIds.some(adjId => state.buildings[adjId]);
  if (distanceRuleViolated) return state;

  // Connection Rule Check (Only for regular phase)
  if (!isSetup) {
    const connectedToPlayerRoad = connectedEdges.some(e => state.roads[e.id] === playerId);
    if (!connectedToPlayerRoad) return state;
  }

  let newPlayerState = isSetup ? player : payCost(player, BUILDING_COSTS.settlement);
  newPlayerState = { ...newPlayerState, victoryPoints: newPlayerState.victoryPoints + 1, resources: { ...newPlayerState.resources } };

  // Setup Round 2 Starting Resources
  if (state.turnPhase === 'SETUP_ROUND_2') {
    const nodeHexes = state.board.graph.nodes.find(n => n.id === nodeId)?.adjacentHexes || [];
    nodeHexes.forEach(hexId => {
      const hex = state.board!.hexes.find(h => h.id === hexId);
      if (hex && hex.resource !== 'desert') {
        newPlayerState.resources[hex.resource] += 1;
      }
    });
  }

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: newPlayerState
    },
    buildings: {
      ...state.buildings,
      [nodeId]: { playerId, type: 'settlement' }
    }
  };
}

export function upgradeCity(state: GameState, nodeId: string, playerId: string): GameState {
  if (state.turnPhase !== 'TRADE_BUILD' || state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  
  const building = state.buildings[nodeId];
  if (!building || building.playerId !== playerId || building.type === 'city') return state;

  const player = state.players[playerId];
  if (!canAfford(player, BUILDING_COSTS.city)) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...payCost(player, BUILDING_COSTS.city),
        victoryPoints: player.victoryPoints + 1 // Settlement gave +1, City gives +1 total +2
      }
    },
    buildings: {
      ...state.buildings,
      [nodeId]: { playerId, type: 'city' }
    }
  };
}

export function buyDevelopmentCard(state: GameState, playerId: string): GameState {
  if (state.turnPhase !== 'TRADE_BUILD' || state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  if (state.devCardDeck.length === 0) return state; // Deck empty
  
  const player = state.players[playerId];
  if (!canAfford(player, BUILDING_COSTS.devCard)) return state;

  const newDeck = [...state.devCardDeck];
  const drawnCard = newDeck.pop()!;

  const newPlayerState = payCost(player, BUILDING_COSTS.devCard);
  newPlayerState.devCards = { ...newPlayerState.devCards, [drawnCard]: newPlayerState.devCards[drawnCard] + 1 };
  
  if (drawnCard === 'victoryPoint') {
    newPlayerState.victoryPoints += 1;
  }

  return {
    ...state,
    devCardDeck: newDeck,
    players: {
      ...state.players,
      [playerId]: newPlayerState
    }
  };
}

export function playKnightCard(state: GameState, playerId: string): GameState {
  if (state.turnPhase !== 'TRADE_BUILD' && state.turnPhase !== 'ROLL') return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  
  const player = state.players[playerId];
  if (player.devCards.knight <= 0) return state;

  let newPlayerState = { 
    ...player, 
    devCards: { ...player.devCards, knight: player.devCards.knight - 1 },
    playedKnights: player.playedKnights + 1
  };

  let newGameState = { ...state };

  // Check Largest Army
  if (newPlayerState.playedKnights >= 3) {
    if (!state.largestArmyPlayer) {
      newGameState.largestArmyPlayer = playerId;
      newPlayerState.victoryPoints += 2;
      newPlayerState.largestArmyAPI = true;
    } else if (state.largestArmyPlayer !== playerId) {
      const currentHolder = state.players[state.largestArmyPlayer];
      if (newPlayerState.playedKnights > currentHolder.playedKnights) {
        newGameState.largestArmyPlayer = playerId;
        newPlayerState.victoryPoints += 2;
        newPlayerState.largestArmyAPI = true;
        
        newGameState.players = {
          ...newGameState.players,
          [currentHolder.id]: {
            ...currentHolder,
            victoryPoints: currentHolder.victoryPoints - 2,
            largestArmyAPI: false
          }
        };
      }
    }
  }

  newGameState.players = {
    ...newGameState.players,
    [playerId]: newPlayerState
  };

  // Trigger Robber move
  newGameState.turnPhase = 'ROBBER_MOVE';

  return newGameState;
}

export function moveRobber(state: GameState, targetHexId: string, targetPlayerIdToSteal: string | null, currentPlayerId: string): GameState {
  if (state.turnPhase !== 'ROBBER_MOVE') return state;
  // Make sure they are actually moving it
  if (state.robberHexId === targetHexId) return state;

  const newGameState = { ...state, robberHexId: targetHexId };
  // Which phase to return to? Assume TRADE_BUILD. If they played knight before rolling, strictly speaking they should return to ROLL, 
  // but we can enforce knight play only during TRADE_BUILD to simplify state machine for now.
  newGameState.turnPhase = 'TRADE_BUILD'; 

  if (targetPlayerIdToSteal && state.players[targetPlayerIdToSteal]) {
    const victim = state.players[targetPlayerIdToSteal];
    const attacker = state.players[currentPlayerId];

    const availableTypes = (Object.keys(victim.resources) as ResourceType[]).filter(r => victim.resources[r] > 0);
    
    if (availableTypes.length > 0) {
      const stolenResource = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      
      newGameState.players = {
        ...newGameState.players,
        [targetPlayerIdToSteal]: {
          ...victim,
          resources: { ...victim.resources, [stolenResource]: victim.resources[stolenResource] - 1 }
        },
        [currentPlayerId]: {
          ...attacker,
          resources: { ...attacker.resources, [stolenResource]: attacker.resources[stolenResource] + 1 }
        }
      };
    }
  }

  return newGameState;
}

export function tradeWithBank(state: GameState, playerId: string, offerResource: ResourceType, askResource: ResourceType): GameState {
  if (state.turnPhase !== 'TRADE_BUILD' || state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  
  const player = state.players[playerId];
  if (player.resources[offerResource] < 4) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        resources: {
          ...player.resources,
          [offerResource]: player.resources[offerResource] - 4,
          [askResource]: player.resources[askResource] + 1
        }
      }
    }
  };
}

import type { HexTile, Intersection, Edge, Harbor } from '../utils/mapGenerator';

export type ResourceType = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export type DevCardType = 'knight' | 'victoryPoint' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: Record<ResourceType, number>;
  devCards: Record<DevCardType, number>;
  playedKnights: number;
  victoryPoints: number;
  longestRoadAPI: boolean; // Just for display maybe
  largestArmyAPI: boolean; // Just for display maybe
}

export type TurnPhase = 'SETUP_ROUND_1' | 'SETUP_ROUND_2' | 'ROLL' | 'TRADE_BUILD' | 'ROBBER_MOVE';

export interface DiceState {
  die1: number;
  die2: number;
  rolled: boolean;
}

export interface GameBoard {
  hexes: HexTile[];
  graph: {
    nodes: Intersection[];
    edges: Edge[];
    harbors: Harbor[];
  }
}

export interface GameState {
  players: Record<string, Player>;
  turnOrder: string[];
  currentTurnIndex: number;
  diceState: DiceState;
  turnPhase: TurnPhase;
  board: GameBoard | null;
  buildings: Record<string, { playerId: string, type: 'settlement' | 'city' }>; // nodeId -> building info
  roads: Record<string, string>; // edgeId -> playerId
  devCardDeck: DevCardType[];
  largestArmyPlayer: string | null;
  longestRoadPlayer: string | null;
  robberHexId: string;
}

export const BUILDING_COSTS = {
  road: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
  devCard: { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 }
};

// Helper to shuffle array
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const initialDeck: DevCardType[] = [
  ...Array(14).fill('knight'),
  ...Array(5).fill('victoryPoint'),
  ...Array(2).fill('roadBuilding'),
  ...Array(2).fill('yearOfPlenty'),
  ...Array(2).fill('monopoly')
];

// Initial Mock Setup (Hotseat Mode 4 Players)
export const initialGameState: GameState = {
  players: {
    'p1': {
      id: 'p1',
      name: 'Player Red',
      color: '#ef4444', // Tailwind red-500
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: { knight: 0, victoryPoint: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 },
      playedKnights: 0,
      victoryPoints: 0,
      longestRoadAPI: false,
      largestArmyAPI: false,
    },
    'p2': {
      id: 'p2',
      name: 'Player Blue',
      color: '#3b82f6', // Tailwind blue-500
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: { knight: 0, victoryPoint: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 },
      playedKnights: 0,
      victoryPoints: 0,
      longestRoadAPI: false,
      largestArmyAPI: false,
    },
    'p3': {
      id: 'p3',
      name: 'Player White',
      color: '#f8fafc', // Tailwind slate-50
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: { knight: 0, victoryPoint: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 },
      playedKnights: 0,
      victoryPoints: 0,
      longestRoadAPI: false,
      largestArmyAPI: false,
    },
    'p4': {
      id: 'p4',
      name: 'Player Orange',
      color: '#f97316', // Tailwind orange-500
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: { knight: 0, victoryPoint: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 },
      playedKnights: 0,
      victoryPoints: 0,
      longestRoadAPI: false,
      largestArmyAPI: false,
    }
  },
  turnOrder: ['p1', 'p2', 'p3', 'p4'],
  currentTurnIndex: 0,
  diceState: { die1: 1, die2: 1, rolled: false },
  turnPhase: 'SETUP_ROUND_1',
  board: null,
  buildings: {},
  roads: {},
  devCardDeck: shuffle(initialDeck),
  largestArmyPlayer: null,
  longestRoadPlayer: null,
  robberHexId: '', // Will be set to desert during map generation or first load
};

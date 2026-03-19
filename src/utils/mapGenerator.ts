import { type HexCoordinate, generateBoardHexes, getHexCorners } from './hexMath';

export type ResourceType = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore' | 'desert';
export type HarborType = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore' | 'any';
export interface HexTile extends HexCoordinate {
  resource: ResourceType;
  numberToken: number | null; 
  id: string; // "q,r"
}

export interface Intersection {
  id: string; // "x,y" (rounded)
  x: number;
  y: number;
  adjacentHexes: string[];
}

export interface Edge {
  id: string; // "nodeId1|nodeId2"
  node1: Intersection;
  node2: Intersection;
  adjacentHexes: string[];
}

export interface Harbor {
  edgeId: string;
  type: HarborType;
  ratio: number;
}

// Catan Standart 19 Tile Resources
const RESOURCES: ResourceType[] = [
  ...Array(4).fill('wood'),
  ...Array(4).fill('sheep'),
  ...Array(4).fill('wheat'),
  ...Array(3).fill('brick'),
  ...Array(3).fill('ore'),
  'desert'
] as ResourceType[];

// Catan Standart 18 Number Tokens (2 and 12 appear once, rest twice)
const NUMBER_TOKENS: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
];

// Knuth Shuffle Algorithm
export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function generateRandomMap(): HexTile[] {
  const hexCoords = generateBoardHexes(2);
  const shuffledResources = shuffle(RESOURCES);
  const shuffledTokens = shuffle(NUMBER_TOKENS);
  
  return hexCoords.map((coord, index) => {
    const resource = shuffledResources[index] as ResourceType;
    let token = null;
    
    // Sadece çöl olmayan yerlere sayı pulu koy
    if (resource !== 'desert') {
      token = shuffledTokens.pop() ?? null;
    }
    
    return {
      q: coord.q,
      r: coord.r,
      resource,
      numberToken: token,
      id: `${coord.q},${coord.r}`
    };
  });
}

export function generateBoardGraph(hexes: HexTile[], hexSize: number) {
  const nodeMap = new Map<string, Intersection>();
  const edgeMap = new Map<string, Edge>();

  hexes.forEach(hex => {
    // 1. Get exact pixel coordinates for corners
    const corners = getHexCorners(hex.q, hex.r, hexSize);
    
    // 2. Round coordinates to prevent floating point errors
    const roundedCorners = corners.map(c => ({
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10
    }));

    // 3. Register Nodes
    const nodeIds = roundedCorners.map(rc => {
      const nodeId = `${rc.x},${rc.y}`;
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, {
          id: nodeId,
          x: rc.x,
          y: rc.y,
          adjacentHexes: []
        });
      }
      // Add this hex to the node's adjacent hexes (only if not already added)
      const node = nodeMap.get(nodeId)!;
      if (!node.adjacentHexes.includes(hex.id)) {
        node.adjacentHexes.push(hex.id);
      }
      return node;
    });

    // 4. Register Edges (between adjacent corners)
    for (let i = 0; i < 6; i++) {
      const n1 = nodeIds[i];
      const n2 = nodeIds[(i + 1) % 6];
      
      // Create a deterministic edge ID by sorting node IDs
      const edgeId = [n1.id, n2.id].sort().join('|');
      
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId,
          node1: n1,
          node2: n2,
          adjacentHexes: []
        });
      }
      
      const edge = edgeMap.get(edgeId)!;
      if (!edge.adjacentHexes.includes(hex.id)) {
        edge.adjacentHexes.push(hex.id);
      }
    }
  });

  // Catan has 9 harbors on the outer edges (edges with exactly 1 adjacent hex)
  const outerEdges = Array.from(edgeMap.values()).filter(e => e.adjacentHexes.length === 1);
  
  // Sort outer edges predictably for harbor placement
  outerEdges.sort((a, b) => a.id.localeCompare(b.id));

  const harborTypes: HarborType[] = [
    'any', 'any', 'any', 'any', // 4 Generic 3:1
    'wood', 'brick', 'sheep', 'wheat', 'ore' // 5 Specialized 2:1
  ];
  
  const shuffledHarbors = shuffle(harborTypes);
  const harbors: Harbor[] = [];
  
  // Distribute the 9 harbors across the outer edges roughly evenly
  if (outerEdges.length > 0) {
    const step = Math.floor(outerEdges.length / 9);
    for (let i = 0; i < 9; i++) {
        const edgeIndex = (i * step) % outerEdges.length;
        const type = shuffledHarbors[i];
        harbors.push({
            edgeId: outerEdges[edgeIndex].id,
            type,
            ratio: type === 'any' ? 3 : 2
        });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
    harbors
  };
}

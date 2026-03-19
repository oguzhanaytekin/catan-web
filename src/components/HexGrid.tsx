import React from 'react';
import { axialToPixel } from '../utils/hexMath';
import { HexTile } from './HexTile';
import type { GameBoard, Player } from '../game/gameState';

interface HexGridProps {
  board: GameBoard | null;
  size: number;
  buildings: Record<string, { playerId: string, type: 'settlement' | 'city' }>;
  roads: Record<string, string>;
  players: Record<string, Player>;
  robberHexId?: string;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onHexClick?: (hexId: string) => void;
}

const getHarborColor = (type: string) => {
  switch(type) {
    case 'wood': return '#22c55e'; // green-500
    case 'brick': return '#dc2626'; // red-600
    case 'sheep': return '#a3e635'; // lime-400
    case 'wheat': return '#eab308'; // yellow-500
    case 'ore': return '#78716c'; // stone-500
    case 'any': return '#f8fafc'; // slate-50
    default: return '#fff';
  }
};

export const HexGrid: React.FC<HexGridProps> = ({ board, size, buildings, roads, players, robberHexId, onNodeClick, onEdgeClick, onHexClick }) => {
  if (!board) return <div>Harita Yükleniyor...</div>;

  const { hexes, graph } = board;
  
  const width = size * 12;
  const height = size * 12;

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`-${width/2} -${height/2} ${width} ${height}`}
      style={{ overflow: 'visible', maxHeight: '100%' }}
    >
      <defs>
        <pattern id="pattern-wood" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-wood)"/>
          <path d="M20,5 L30,25 L10,25 Z" fill="#064e3b" opacity="0.6"/>
          <path d="M10,15 L20,35 L0,35 Z" fill="#047857" opacity="0.8"/>
          <path d="M30,10 L40,30 L20,30 Z" fill="#047857" opacity="0.5"/>
        </pattern>
        <pattern id="pattern-brick" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-brick)"/>
          <circle cx="10" cy="30" r="15" fill="#991b1b" opacity="0.5"/>
          <circle cx="30" cy="20" r="18" fill="#7f1d1d" opacity="0.4"/>
          <path d="M0,40 Q10,25 20,40 T40,40 L40,40 L0,40 Z" fill="#b91c1c" opacity="0.8"/>
        </pattern>
        <pattern id="pattern-sheep" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-sheep)"/>
          <path d="M5,30 Q10,20 15,30 Z" fill="#4d7c0f" opacity="0.4"/>
          <path d="M25,35 Q30,25 35,35 Z" fill="#4d7c0f" opacity="0.4"/>
          <circle cx="20" cy="15" r="4" fill="#f8fafc" opacity="0.9"/>
          <circle cx="24" cy="15" r="5" fill="#f8fafc" opacity="0.9"/>
          <circle cx="17" cy="17" r="3" fill="#cbd5e1" opacity="0.9"/>
        </pattern>
        <pattern id="pattern-wheat" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-wheat)"/>
          <path d="M10,40 L15,20 L20,40 M30,40 L25,25 L35,40" stroke="#ca8a04" strokeWidth="2" fill="none" opacity="0.6"/>
          <path d="M15,20 L12,25 M15,20 L18,25 M25,25 L22,30 M25,25 L28,30" stroke="#ca8a04" strokeWidth="2" fill="none" opacity="0.6"/>
        </pattern>
        <pattern id="pattern-ore" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-ore)"/>
          <path d="M20,10 L35,40 L5,40 Z" fill="#334155" />
          <path d="M20,10 L26,20 L14,20 Z" fill="#cbd5e1" opacity="0.5"/>
          <path d="M30,20 L40,40 L20,40 Z" fill="#1e293b" opacity="0.7"/>
        </pattern>
        <pattern id="pattern-desert" viewBox="0 0 40 40" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="var(--res-desert)"/>
          <path d="M0,20 Q10,10 20,20 T40,20" stroke="#b45309" strokeWidth="1" fill="none" opacity="0.3"/>
          <path d="M0,30 Q10,20 20,30 T40,30" stroke="#b45309" strokeWidth="1" fill="none" opacity="0.3"/>
        </pattern>
      </defs>

      {/* 1. Base Layer: Hexes */}
      {hexes.map((hex) => {
        const { x: centerX, y: centerY } = axialToPixel(hex.q, hex.r, size);
        return (
          <g 
            key={hex.id}
            className="hex-group" 
            transform={`translate(${centerX}, ${centerY})`}
            onClick={() => onHexClick?.(hex.id)}
            style={{ cursor: onHexClick ? 'pointer' : 'default' }}
          >
            <HexTile 
              x={0} 
              y={0} 
              size={size} 
              resource={hex.resource} 
              numberToken={hex.numberToken} 
            />

            {/* Robber 3D Pawn */}
            {robberHexId === hex.id && (
              <g className="anim-drop-in" style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 10px 6px rgba(0,0,0,0.7))' }}>
                <rect x={-size * 0.25} y={-size * 0.4} width={size * 0.5} height={size * 0.5} fill="#1f2937" rx={size * 0.1} stroke="#000" strokeWidth="2" />
                <circle cx={0} cy={-size * 0.45} r={size * 0.25} fill="#374151" stroke="#000" strokeWidth="2" />
                <text y={-size * 0.1} textAnchor="middle" fill="#9ca3af" fontSize={size * 0.35} fontWeight="bold">R</text>
              </g>
            )}
          </g>
        );
      })}

      {/* 1.5 Middle Layer: Harbors */}
      {graph.harbors?.map((harbor, i) => {
        const edge = graph.edges.find(e => e.id === harbor.edgeId);
        if (!edge) return null;
        
        // Calculate the midpoint of the edge
        const midX = (edge.node1.x + edge.node2.x) / 2;
        const midY = (edge.node1.y + edge.node2.y) / 2;
        
        // Calculate the normal vector to point outwards (away from the center of the board)
        // For simplicity, we just push it slightly away from the hex center it belongs to
        // Because outer edges only have 1 adjacent hex, we use that hex's center
        const adjacentHex = hexes.find(h => h.id === edge.adjacentHexes[0]);
        let offsetX = 0;
        let offsetY = 0;
        
        if (adjacentHex) {
          const { x: hexX, y: hexY } = axialToPixel(adjacentHex.q, adjacentHex.r, size);
          const dx = midX - hexX;
          const dy = midY - hexY;
          const len = Math.sqrt(dx * dx + dy * dy);
          // Push out by half a hex size
          offsetX = (dx / len) * (size * 0.4);
          offsetY = (dy / len) * (size * 0.4);
        }

        const hx = midX + offsetX;
        const hy = midY + offsetY;

        return (
          <g key={`harbor-${harbor.edgeId}-${i}`} className="harbor" transform={`translate(${hx}, ${hy})`}>
            {/* Harbor Dock Line connecting to edge */}
            <line x1={-offsetX} y1={-offsetY} x2={0} y2={0} stroke="#8B4513" strokeWidth={size * 0.1} strokeDasharray="4,2" />
            
            {/* Harbor Bubble */}
            <circle cx={0} cy={0} r={size * 0.3} fill="#1e40af" stroke="#93c5fd" strokeWidth="2" style={{ filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }} />
            <circle cx={0} cy={0} r={size * 0.22} fill={getHarborColor(harbor.type)} />
            
            {/* Harbor Ratio Text */}
            <text 
              x={0} 
              y={size * 0.08} 
              textAnchor="middle" 
              fill={harbor.type === 'any' ? '#000' : '#fff'} 
              fontSize={size * 0.2} 
              fontWeight="bold"
              style={{ textShadow: harbor.type === 'any' ? 'none' : '0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {harbor.ratio}:1
            </text>
          </g>
        );
      })}

      {/* 2. Middle Layer: Edges (Roads) */}
      {graph.edges.map(edge => {
        const ownerId = roads[edge.id];
        const owner = ownerId ? players[ownerId] : null;

        return (
          <g key={`edge-${edge.id}`}>
            {/* 3D Extrusion (Thickness) for built roads */}
            {owner && (
              <line 
                className="anim-draw-road"
                x1={edge.node1.x} y1={edge.node1.y + 6}
                x2={edge.node2.x} y2={edge.node2.y + 6}
                stroke={owner.color}
                strokeWidth={size * 0.15}
                strokeLinecap="round"
                style={{ filter: 'brightness(0.5)' }}
              />
            )}
            {/* Main Interactive Road Line */}
            <line
              className={owner ? "anim-draw-road" : ""}
              x1={edge.node1.x}
              y1={edge.node1.y}
              x2={edge.node2.x}
              y2={edge.node2.y}
              stroke={owner ? owner.color : "transparent"}
              strokeWidth={owner ? size * 0.15 : size * 0.3} // Actual road width vs invisible click area
              strokeLinecap="round"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={() => onEdgeClick?.(edge.id)}
              onMouseEnter={(e) => {
                if (!owner) {
                  e.currentTarget.setAttribute('stroke', 'rgba(255, 255, 255, 0.5)');
                  e.currentTarget.setAttribute('stroke-width', String(size * 0.1));
                }
              }}
              onMouseLeave={(e) => {
                if (!owner) {
                  e.currentTarget.setAttribute('stroke', 'transparent');
                  e.currentTarget.setAttribute('stroke-width', String(size * 0.3));
                }
              }}
            />
          </g>
        );
      })}

      {/* 3. Top Layer: Intersections (Settlements/Cities) */}
      {graph.nodes.map(node => {
        const building = buildings[node.id];
        const owner = building ? players[building.playerId] : null;
        
        return (
          <g key={`node-${node.id}`}>
            {/* Clickable invisible circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={size * 0.25} // Hitbox size
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onNodeClick?.(node.id)}
              onMouseEnter={(e) => {
                if (!owner) {
                  e.currentTarget.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
                  e.currentTarget.setAttribute('r', String(size * 0.15));
                }
              }}
              onMouseLeave={(e) => {
                if (!owner) {
                  e.currentTarget.setAttribute('fill', 'transparent');
                  e.currentTarget.setAttribute('r', String(size * 0.25));
                }
              }}
            />
            {/* Render 3D settlement/city visuals if owned */}
            {owner && building.type === 'settlement' && (
               <g className="anim-drop-in" style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 6px 4px rgba(0,0,0,0.6))' }}>
                 {/* Body */}
                 <rect x={node.x - 10} y={node.y - 5} width={20} height={15} fill={owner.color} style={{ filter: 'brightness(0.7)' }} stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
                 {/* Roof */}
                 <polygon points={`${node.x - 12},${node.y - 5} ${node.x},${node.y - 15} ${node.x + 12},${node.y - 5}`} fill={owner.color} stroke="white" strokeWidth="1.5" />
               </g>
            )}
            {owner && building.type === 'city' && (
               <g className="anim-drop-in" style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 8px 5px rgba(0,0,0,0.7))' }}>
                 {/* Main Body */}
                 <rect x={node.x - 14} y={node.y - 5} width={28} height={16} fill={owner.color} style={{ filter: 'brightness(0.6)' }} stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
                 {/* Tower Body */}
                 <rect x={node.x + 2} y={node.y - 20} width={12} height={20} fill={owner.color} style={{ filter: 'brightness(0.8)' }} stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
                 {/* Main Roof */}
                 <polygon points={`${node.x - 16},${node.y - 5} ${node.x - 2},${node.y - 12} ${node.x + 6},${node.y - 5}`} fill={owner.color} stroke="#fbbf24" strokeWidth="1.5" />
                 {/* Tower Roof */}
                 <polygon points={`${node.x},${node.y - 20} ${node.x + 8},${node.y - 30} ${node.x + 16},${node.y - 20}`} fill={owner.color} stroke="#fbbf24" strokeWidth="1.5" />
               </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

import React from 'react';
import type { ResourceType } from '../utils/mapGenerator';

interface HexTileProps {
  x: number;
  y: number;
  size: number;
  resource: ResourceType;
  numberToken: number | null;
  onClick?: () => void;
}

export const HexTile: React.FC<HexTileProps> = ({ x, y, size, resource, numberToken, onClick }) => {
  // Pointy Topped Hexagon corner calculation
  const points = Array.from({ length: 6 }).map((_, i) => {
    const angle_deg = 60 * i - 30; // Pointy top
    const angle_rad = Math.PI / 180 * angle_deg;
    return `${x + size * Math.cos(angle_rad)},${y + size * Math.sin(angle_rad)}`;
  }).join(' ');

  const THICKNESS = 15;
  const bottomPoints = Array.from({ length: 6 }).map((_, i) => {
    const angle_deg = 60 * i - 30; // Pointy top
    const angle_rad = Math.PI / 180 * angle_deg;
    return `${x + size * Math.cos(angle_rad)},${y + THICKNESS + size * Math.sin(angle_rad)}`;
  }).join(' ');

  // SVG Y offset for the bottom face creates the isometric depth due to our X/Z tilt in App.tsx
  // We draw the bottom extrusion first
  const fillColor = `url(#pattern-${resource})`;
  const darkColor = `var(--res-${resource}-dark)`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer', transition: 'all 0.3s ease' }} className="hex-tile">
      {/* Extruded Bottom / Thickness Body */}
      <polygon 
        points={bottomPoints} 
        fill={darkColor} 
        stroke="rgba(0,0,0,0.3)" 
        strokeWidth="1"
      />
      {/* Front Side Panels to give solid volume */}
      {/* Bottom Right Edge */}
      <polygon
        points={`
          ${x + size * Math.cos(Math.PI/180 * 30)},${y + size * Math.sin(Math.PI/180 * 30)}
          ${x + size * Math.cos(Math.PI/180 * 90)},${y + size * Math.sin(Math.PI/180 * 90)}
          ${x + size * Math.cos(Math.PI/180 * 90)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 90)}
          ${x + size * Math.cos(Math.PI/180 * 30)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 30)}
        `}
        fill={darkColor}
        style={{ filter: 'brightness(0.8)' }}
      />
      {/* Bottom Edge */}
      <polygon
        points={`
          ${x + size * Math.cos(Math.PI/180 * 90)},${y + size * Math.sin(Math.PI/180 * 90)}
          ${x + size * Math.cos(Math.PI/180 * 150)},${y + size * Math.sin(Math.PI/180 * 150)}
          ${x + size * Math.cos(Math.PI/180 * 150)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 150)}
          ${x + size * Math.cos(Math.PI/180 * 90)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 90)}
        `}
        fill={darkColor}
        style={{ filter: 'brightness(0.6)' }}
      />
      {/* Bottom Left Edge */}
      <polygon
        points={`
          ${x + size * Math.cos(Math.PI/180 * 150)},${y + size * Math.sin(Math.PI/180 * 150)}
          ${x + size * Math.cos(Math.PI/180 * 210)},${y + size * Math.sin(Math.PI/180 * 210)}
          ${x + size * Math.cos(Math.PI/180 * 210)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 210)}
          ${x + size * Math.cos(Math.PI/180 * 150)},${y + THICKNESS + size * Math.sin(Math.PI/180 * 150)}
        `}
        fill={darkColor}
        style={{ filter: 'brightness(0.9)' }}
      />

      {/* Top Face */}
      <polygon 
        points={points} 
        fill={fillColor} 
        stroke="rgba(255,255,255,0.2)" 
        strokeWidth="2"
      />
      {numberToken && (
        <g>
          <circle cx={x} cy={y} r={size * 0.35} fill="#fdfbf7" stroke="#dcd0b1" strokeWidth="2" />
          <text 
            x={x} 
            y={y + 6} 
            textAnchor="middle" 
            fontSize={numberToken === 6 || numberToken === 8 ? "18" : "14"} 
            fontWeight="bold" 
            fill={numberToken === 6 || numberToken === 8 ? "#b91c1c" : "#1f2937"}
          >
            {numberToken}
          </text>
        </g>
      )}
    </g>
  );
};

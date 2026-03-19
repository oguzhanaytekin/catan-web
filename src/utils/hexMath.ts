export interface HexCoordinate {
  q: number;
  r: number;
}

export function generateBoardHexes(radius: number = 2): HexCoordinate[] {
  const hexes: HexCoordinate[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}

export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  // Pointy-topped hexagons
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

export function getHexCorners(q: number, r: number, size: number): { x: number; y: number }[] {
  const { x: cx, y: cy } = axialToPixel(q, r, size);
  return Array.from({ length: 6 }).map((_, i) => {
    const angle_deg = 60 * i - 30; // Pointy top
    const angle_rad = Math.PI / 180 * angle_deg;
    return {
      x: cx + size * Math.cos(angle_rad),
      y: cy + size * Math.sin(angle_rad)
    };
  });
}

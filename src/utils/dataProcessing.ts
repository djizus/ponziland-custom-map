import { PonziLand, PonziLandStake } from '../types/ponziland';
import { GRID_SIZE, COORD_MULTIPLIER, COORD_MASK, LOCATION_MASK } from '../constants/ponziland';

const LOCATION_BIT_MASK = BigInt(LOCATION_MASK);
const COLUMN_MASK = BigInt(COORD_MASK);
const ROW_SHIFT = BigInt(8);

const toBigInt = (value: number | string | bigint | undefined | null): bigint | null => {
  if (value === undefined || value === null) return null;
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.startsWith('0x') || trimmed.startsWith('0X')
      ? BigInt(trimmed)
      : BigInt(trimmed);
  } catch (error) {
    console.warn('Failed to parse location to BigInt:', value, error);
    return null;
  }
};

export const normalizeLocation = (
  location: number | string | bigint | undefined | null,
): number | null => {
  const big = toBigInt(location);
  if (big === null) return null;
  return Number(big & LOCATION_BIT_MASK);
};

// Convert location number to coordinates (x, y)
export const getCoordinates = (
  location: number | string | bigint | undefined | null,
): [number, number] => {
  const big = toBigInt(location);
  if (big === null) return [0, 0];

  const normalized = big & LOCATION_BIT_MASK;
  const col = Number(normalized & COLUMN_MASK);
  const row = Number((normalized >> ROW_SHIFT) & COLUMN_MASK);
  return [col, row];
};

export const encodeCoordinates = (col: number, row: number): number => {
  return row * COORD_MULTIPLIER + col;
};

export const processGridData = (lands: PonziLand[], stakes: PonziLandStake[]) => {
  const grid = Array(GRID_SIZE * GRID_SIZE).fill(null) as (PonziLand | null)[];

  const stakesMap = stakes.reduce((acc, stake) => {
    const normalized = normalizeLocation(stake.location);
    if (normalized !== null) {
      acc[normalized] = stake.amount;
    }
    return acc;
  }, {} as Record<number, string>);

  const rowSet = new Set<number>();
  const colSet = new Set<number>();
  const locationSet = new Set<number>();

  lands.forEach(land => {
    const normalized = normalizeLocation(land.location);
    if (normalized === null) return;

    const [col, row] = getCoordinates(land.location);
    rowSet.add(row);
    colSet.add(col);
    locationSet.add(normalized);

    grid[normalized] = {
      ...land,
      staked_amount: stakesMap[normalized] || '0x0'
    };
  });

  const activeRows = Array.from(rowSet).sort((a, b) => a - b);
  const activeCols = Array.from(colSet).sort((a, b) => a - b);
  const activeLocations = Array.from(locationSet).sort((a, b) => a - b);

  return {
    tiles: grid,
    activeRows,
    activeCols,
    activeLocations
  };
};

export const getLevelNumber = (level: string | undefined): number => {
  if (!level) return 1;
  switch (level.toLowerCase()) {
    case 'zero': return 1;
    case 'first': return 2;
    case 'second': return 3;
    default: return 1;
  }
};

export const getNeighborLocations = (location: number): number[] => {
  const row = Math.floor(location / GRID_SIZE);
  const col = location % GRID_SIZE;
  const neighbors: number[] = [];
  
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const newRow = row + i;
      const newCol = col + j;
      if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
        neighbors.push(newRow * GRID_SIZE + newCol);
      }
    }
  }
  return neighbors;
}; 

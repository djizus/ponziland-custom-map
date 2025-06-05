import { PonziLand, PonziLandStake } from '../types/ponziland';
import { GRID_SIZE } from '../constants/ponziland';

// Convert location number to coordinates
export const getCoordinates = (location: number | string): [string, string] => {
  const numLocation = typeof location === 'string' ? Number(location) : location;
  const x = numLocation % GRID_SIZE;
  const y = Math.floor(numLocation / GRID_SIZE);
  return [x.toString(), y.toString()];
};

export const processGridData = (lands: PonziLand[], stakes: PonziLandStake[]) => {
  const grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
  let minRow = GRID_SIZE;
  let maxRow = 0;
  let minCol = GRID_SIZE;
  let maxCol = 0;

  const stakesMap = stakes.reduce((acc, stake) => {
    acc[Number(stake.location)] = stake.amount;
    return acc;
  }, {} as Record<number, string>);

  lands.forEach(land => {
    const location = Number(land.location);
    const [x, y] = getCoordinates(location);
    minRow = Math.min(minRow, Number(y));
    maxRow = Math.max(maxRow, Number(y));
    minCol = Math.min(minCol, Number(x));
    maxCol = Math.max(maxCol, Number(x));
  });

  lands.forEach(land => {
    const location = Number(land.location);
    grid[location] = {
      ...land,
      staked_amount: stakesMap[location] || '0x0'
    };
  });

  const activeRows = Array.from(
    { length: maxRow - minRow + 1 },
    (_, i) => minRow + i
  );
  const activeCols = Array.from(
    { length: maxCol - minCol + 1 },
    (_, i) => minCol + i
  );

  return {
    tiles: grid,
    activeRows,
    activeCols
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
import { PonziLand, PonziLandAuction, PonziLandStake, TaxInfo, SelectedTileDetails, TokenPrice } from '../types/ponziland';
import styled from 'styled-components';
import { useEffect, useState, useRef } from 'react';


// --- Tax System Constants ---
const TAX_RATE_RAW = 2; // Represents 2%
const TIME_SPEED_FACTOR = 5;

const MapWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
  background: #1a1a1a;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const GridContainer = styled.div<{ zoom: number }>`
  display: grid;
  gap: ${props => 2 * props.zoom}px;
  width: fit-content;
  margin: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transform: scale(${props => props.zoom});
  transform-origin: center top;
  transition: transform 0.2s ease;
`;

// Add keyframes for the pulse animation
const pulseAnimation = `
  @keyframes pulse {
    0% {
      box-shadow: 0 0 10px rgba(204, 102, 204, 1), 0 0 20px rgba(204, 102, 204, 0.5);
      border-color: rgba(204, 102, 204, 1);
    }
    50% {
      box-shadow: 0 0 15px rgba(204, 102, 204, 1), 0 0 30px rgba(204, 102, 204, 0.7);
      border-color: rgba(255, 182, 255, 1);
    }
    100% {
      box-shadow: 0 0 10px rgba(204, 102, 204, 1), 0 0 20px rgba(204, 102, 204, 0.5);
      border-color: rgba(204, 102, 204, 1);
    }
  }
`;

const Tile = styled.div<{
  $isMyLand: boolean;
  $level: number;
  $isEmpty: boolean;
  $valueColor: string;
  $isAuction: boolean;
  $opportunityColor: string;
  $isNukable: 'nukable' | 'warning' | false;
  $auctionYield?: number;
}>`
  ${pulseAnimation}
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: ${props => {
    if (props.$isEmpty) return '#1a1a1a';
    if (props.$isAuction) return '#1f1b2e';
    if (props.$isNukable === 'warning') return '#4d3015'; // Orange background for warning state
    return props.$valueColor;
  }};
  border: ${props => {
    if (props.$isMyLand) {
      return '3px solid gold';
    }
    if (props.$isAuction) {
      const yield_ = props.$auctionYield || 0;
      if (yield_ >= 50) {
        return '2px solid rgba(204, 102, 204, 1)';
      }
      const alpha = Math.min(0.3 + (yield_ / 30) * 0.7, 1.0);
      return `1px solid rgba(204, 102, 204, ${alpha})`;
    }
    if (props.$isNukable === 'nukable') {
      return '2px solid #ff0000';
    }
    // Remove border for warning state
    if (props.$isNukable === 'warning') {
      return 'none';
    }
    return `2px solid ${props.$opportunityColor}`;
  }};
  box-shadow: ${props => {
    if (props.$isMyLand) {
      return props.$opportunityColor !== '#333' 
        ? `0 0 15px rgba(255, 215, 0, 0.5), 0 0 10px ${props.$opportunityColor}`
        : '0 0 15px rgba(255, 215, 0, 0.5)';
    }
    if (props.$isAuction) {
      const yield_ = props.$auctionYield || 0;
      if (yield_ >= 50) {
        return '0 0 15px rgba(204, 102, 204, 1), 0 0 30px rgba(204, 102, 204, 0.7)';
      }
      const alpha = Math.min(0.2 + (yield_ / 30) * 0.8, 1.0);
      return `0 0 10px rgba(204, 102, 204, ${alpha})`;
    }
    if (props.$isNukable === 'nukable') {
      return '0 0 10px rgba(255, 0, 0, 0.3)';
    }
    // Remove glow for warning state
    if (props.$isNukable === 'warning') {
      return 'none';
    }
    if (props.$opportunityColor !== '#333') {
      return `0 0 10px ${props.$opportunityColor}`;
    }
    return 'none';
  }};
  animation: ${props => {
    if (props.$isAuction && (props.$auctionYield || 0) >= 50) {
      return 'pulse 2s infinite';
    }
    return 'none';
  }};
  color: white;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
    z-index: 1;
  }
`;

const TileHeader = styled.div`
  font-weight: bold;
  color: #7cb3ff;
  font-size: 14px;
  margin-bottom: 4px;
  text-align: center;
`;

const TileLocation = styled.div`
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

const TileLevel = styled.div`
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

const GRID_SIZE = 64;

// Convert location number to coordinates
const getCoordinates = (location: number | string): [string, string] => {
  const numLocation = typeof location === 'string' ? Number(location) : location;
  const x = numLocation % GRID_SIZE;
  const y = Math.floor(numLocation / GRID_SIZE);
  return [x.toString(), y.toString()];
};

const processGridData = (lands: PonziLand[], stakes: PonziLandStake[]) => {
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

const getLevelNumber = (level: string | undefined): number => {
  if (!level) return 1;
  switch (level.toLowerCase()) {
    case 'zero': return 1;
    case 'first': return 2;
    case 'second': return 3;
    default: return 1;
  }
};

const PlayerListPanel = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  width: 220px; /* Reduced from 300px */
  max-height: 300px; // Max height before scrolling
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  ${props => props.$isMinimized && `
    width: auto; /* Shrink to content width when minimized */
    min-width: unset;
    padding: 10px;
    max-height: 50px; /* Height of header when minimized */
    cursor: pointer;
    
    .player-list-content {
      display: none;
    }
  `}
`;

// General Panel Header for minimizable panels
const PanelHeader = styled.div<{ $isMinimized: boolean }>`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: ${props => props.$isMinimized ? '0' : '10px'};
  color: #fff;
  text-align: center;
  border-bottom: ${props => props.$isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'};
  padding-bottom: ${props => props.$isMinimized ? '0' : '8px'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
`;

const PlayerListContent = styled.div`
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-right: 5px; // For scrollbar spacing

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px;
    border-radius: 3px;
    cursor: pointer;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
  input[type="checkbox"] {
    cursor: pointer;
  }
  .player-address {
    font-size: 10px;
    color: #aaa;
    margin-left: auto; /* Push address to the right */
  }
`;

const ZoomControls = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  bottom: 60px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  ${props => props.$isMinimized && `
    .zoom-controls {
      display: none;
    }
    padding: 10px;
    width: auto;
  `}
`;

const ZoomControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ZoomButton = styled.button`
  background: #2a4b8d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  transition: all 0.2s;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #1e3a7b;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0px);
  }
`;

const ZoomLevel = styled.div`
  color: white;
  padding: 4px 8px;
  font-size: 14px;
  min-width: 60px;
  text-align: center;
`;


const PriceDisplay = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  transition: all 0.3s ease;
  
  ${props => props.$isMinimized && `
    min-width: unset;
    padding: 10px;
    cursor: pointer;
    
    ${PriceRow}, ${TokenValue} {
      display: none;
    }
  `}
`;

const PriceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 14px;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 4px;
  }
`;

const TokenSymbol = styled.span`
  color: #7cb3ff;
  font-weight: bold;
  min-width: 80px;
`;

const TokenValue = styled.span`
  color: ${props => props.color || '#fff'};
  text-align: right;
`;

const PriceHeader = styled.div<{ $isMinimized: boolean }>`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: ${props => props.$isMinimized ? '0' : '10px'};
  color: #fff;
  text-align: center;
  border-bottom: ${props => props.$isMinimized ? 'none' : '2px solid rgba(255, 255, 255, 0.2)'};
  padding-bottom: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
`;

const MinimizeButton = styled.span`
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
  &:hover {
    color: #7cb3ff;
  }
`;

const formatRatio = (ratio: number | null): string => {
  if (ratio === null || ratio === undefined) {
    return 'N/A';
  }
  if (ratio >= 1) {
    return ratio.toFixed(2);
  }
  // For small numbers, calculate appropriate decimal places
  const decimalPlaces = Math.max(2, -Math.floor(Math.log10(ratio)) + 2);
  return ratio.toFixed(decimalPlaces);
};

const getTokenInfo = (address: string, prices: TokenPrice[]): { symbol: string; ratio: number | null } => {
  if (!address) return { symbol: 'Unknown', ratio: null };
  const addrKey = address.toLowerCase();
  const tokenInfo = prices.find(p => p.address.toLowerCase() === addrKey);
  return {
    symbol: tokenInfo?.symbol || 'Unknown',
    ratio: tokenInfo?.ratio || null
  };
};

const formatOriginalPrice = (price: string | null): string => {
  if (!price) return 'Not for sale';
  const bigIntPrice = BigInt(price);
  const divisor = BigInt('1000000000000000000'); // 18 decimals
  const wholePart = bigIntPrice / divisor;
  const fractionalPart = bigIntPrice % divisor;
  const formattedFractional = fractionalPart.toString().padStart(18, '0').slice(0, 2);
  return `${wholePart}${formattedFractional ? `.${formattedFractional}` : ''}`;
};

const calculateESTRKPrice = (originalPrice: string | null, ratio: number | null): string => {
  if (!originalPrice || ratio === null || ratio === undefined) return '';
  const price = Number(formatOriginalPrice(originalPrice));
  return (price / ratio).toFixed(2);
};

const formatCoordinate = (num: number | string): string => {
  if (typeof num === 'string') {
    const parsed = parseInt(num, 10);
    return parsed === 0 ? "0" : parsed.toString();
  }
  return num === 0 ? "0" : num.toString();
};

const displayCoordinates = (x: number | string, y: number | string): string => {
  return `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
};

// Update value color to use pure green/red gradients with more grey near zero
const getValueColor = (price: string | null, profitPerHour: number): string => {
  if (!price) return '#2a2a2a';  // No price = dark gray
  
  // Negative yield = grey to red progression
  if (profitPerHour <= -20) return '#4d1515';  // Very negative yield = darkest red
  if (profitPerHour <= -15) return '#4d1818';
  if (profitPerHour <= -10) return '#4d1b1b';
  if (profitPerHour <= -7) return '#452020';   // More grey-red
  if (profitPerHour <= -5) return '#403030';   // Very grey-red
  if (profitPerHour <= -3) return '#383232';   // Almost grey with red tint
  if (profitPerHour < 0) return '#333232';     // Barely red grey
  
  // Zero and near-zero yields = grey progression
  if (profitPerHour === 0) return '#2d2d2d';   // Pure grey
  if (profitPerHour <= 1) return '#2d2e2d';    // Barely green grey
  if (profitPerHour <= 3) return '#2d302d';    // Almost grey with green tint
  if (profitPerHour <= 5) return '#2d332d';    // Very grey-green
  if (profitPerHour <= 7) return '#2d362d';    // More grey-green
  
  // Higher positive yield = stronger green progression
  if (profitPerHour <= 10) return '#1a331a';
  if (profitPerHour <= 15) return '#1a391a';
  if (profitPerHour <= 20) return '#1a3f1a';
  if (profitPerHour <= 30) return '#1a451a';
  if (profitPerHour <= 40) return '#1a4b1a';
  if (profitPerHour <= 50) return '#1a511a';
  return '#1a571a';                            // Highest yield = brightest green
};


// Modified getTaxRate
const getTaxRate = (level: string | undefined, locationNum: number): number => {
  const numCardinalNeighbors = getNeighborLocations(locationNum).length;

  if (numCardinalNeighbors === 0) {
    return 0; // No tax if no cardinal neighbors to pay to/receive from based on this logic
  }

  // Base rate factor per neighbor, incorporating TAX_RATE_RAW and TIME_SPEED_FACTOR
  // Formula: (TAX_RATE_RAW / 100.0) * TIME_SPEED_FACTOR / numCardinalNeighbors
  const baseRate = (TAX_RATE_RAW / 100.0) * TIME_SPEED_FACTOR / numCardinalNeighbors;
  
  let discountedRate = baseRate;
  if (level) {
    switch (level.toLowerCase()) {
      case 'first':  // Level 'First': 10% reduction from baseRate
        discountedRate = baseRate * 0.9;
        break;
      case 'second': // Level 'Second': 15% reduction from baseRate
        discountedRate = baseRate * 0.85;
        break;
      case 'zero':   // Level 'Zero': 0% reduction
      default:
        // discountedRate remains baseRate
        break;
    }
  }
  return discountedRate;
};

const convertToESTRK = (price: string | null, symbol: string, ratio: number | null): number => {
  if (!price || symbol === 'nftSTRK') return Number(formatOriginalPrice(price));
  if (ratio === null || ratio === undefined) return 0;
  return Number(calculateESTRKPrice(price, ratio));
};

const getNeighborLocations = (location: number): number[] => {
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

const calculateTaxInfo = (
  location: number,
  lands: (PonziLand | null)[],
  prices: TokenPrice[],
  activeAuctions: Record<number, PonziLandAuction>
): TaxInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { taxPaid: 0, taxReceived: 0, profitPerHour: 0 };
  }

  const neighbors = getNeighborLocations(location);
  let taxPaid = 0;
  let taxReceived = 0;

  const { symbol: mySymbol, ratio: myRatio } = getTokenInfo(currentLand.token_used, prices);
  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);

  if (currentLand.sell_price) {
    const myTaxRate = getTaxRate(currentLand.level, Number(currentLand.location));
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        taxPaid += myPriceESTRK * myTaxRate;
      }
    });
  }

  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
      const neighborTaxRate = getTaxRate(neighbor.level, Number(neighbor.location));
      taxReceived += neighborPriceESTRK * neighborTaxRate;
    }
  });

  return {
    taxPaid,
    taxReceived,
    profitPerHour: taxReceived - taxPaid
  };
};

// Update ROI calculation to include purchase price
const calculateROI = (profitPerHour: number, landPriceESTRK: number): number => {
  if (landPriceESTRK <= 0) return 0;
  // ROI = (profit per hour / purchase price) × 100
  // Only the purchase price is considered as the investment
  return (profitPerHour / landPriceESTRK) * 100;
};

// Update opportunity color to highlight high ROI only for lands with significant yield
const getOpportunityColor = (profitPerHour: number, landPriceESTRK: number): string => {
  // Only consider ROI for lands earning more than 10 tokens per hour
  if (profitPerHour <= 4) return '#333';
  const roi = calculateROI(profitPerHour, landPriceESTRK);
  if (roi <= 10) return '#333';  // MODIFIED: Require minimum 50% hourly ROI
  
  // Scale intensity based on ROI for high-yield lands
  // Max brightness at 100% ROI, starting from 0%
  const intensity = Math.min((roi) / 100, 1); // MODIFIED: (roi - 50) / (400 - 50)
  
  return `rgba(0, 255, 255, ${intensity})`; // Cyan color for high ROI + high yield borders
};


const CompactTaxInfo = styled.div`
  font-size: 11px;
  color: #bbb;
  text-align: center;
  line-height: 1.2;
`;

const GameLink = styled.a`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: #2a4b8d;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;

  &:hover {
    background: #1e3a7b;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0px);
  }

  &:visited {
    color: white;
  }
`;

// Function to calculate burn rate per hour in original token
const calculateBurnRate = (land: PonziLand | null, lands: (PonziLand | null)[], activeAuctions: Record<number, PonziLandAuction>): number => {
  if (!land || !land.sell_price) return 0;
  
  const neighbors = getNeighborLocations(Number(land.location));
  const taxRate = getTaxRate(land.level, Number(land.location));
  let burnRate = 0;
  
  // Calculate burn rate using the same logic as tax calculation
  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    // Only count burn rate for neighbors that exist, are not on auction, and have an owner
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
      burnRate += hexToDecimal(land.sell_price) * taxRate;
    }
  });
  
  return burnRate;
};

const StakedInfo = styled.div<{ $isNukable: 'nukable' | 'warning' | false }>`
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: ${props => {
    switch (props.$isNukable) {
      case 'nukable':
        return 'rgba(255, 0, 0, 0.5)';
      case 'warning':
        return 'rgba(255, 165, 0, 0.5)';
      default:
        return 'rgba(0, 0, 0, 0.5)';
    }
  }};
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: ${props => {
    switch (props.$isNukable) {
      case 'nukable':
        return '#ff9999';
      case 'warning':
        return '#ffd700';
      default:
        return '#fff';
    }
  }};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
`;

// Function to convert hex string to decimal
const hexToDecimal = (hex: string): number => {
  if (!hex || hex === '0x0') return 0;
  return parseInt(hex, 16) / 1e18; // Assuming 18 decimals
};

// Function to check if a land is nukable (no staked tokens) or close to nukable
const isNukable = (land: PonziLand | null, burnRate: number): 'nukable' | 'warning' | false => {
  if (!land) return false;
  const stakedAmount = hexToDecimal(land.staked_amount || '0x0');
  if (stakedAmount <= 0) return 'nukable';
  
  // Calculate time remaining in hours
  const timeRemainingHours = stakedAmount / burnRate;
  // Convert to minutes and check if less than or equal to 10 minutes
  const timeRemainingMinutes = timeRemainingHours * 60;
  
  return timeRemainingMinutes <= 10 ? 'warning' : false;
};

// Format time remaining showing only hours and minutes
const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) return 'NUKABLE';
  
  // Convert to minutes for better precision but round to whole minutes
  const totalMinutes = Math.round(hours * 60);
  
  // Calculate hours and remaining minutes
  const hoursLeft = Math.floor(totalMinutes / 60);
  const minutesLeft = totalMinutes % 60;
  
  // Add warning indicator for 10 minutes or less
  const timeString = hoursLeft === 0 ? `${minutesLeft}m` : `${hoursLeft}h ${minutesLeft}m`;
  return totalMinutes <= 10 ? `⚠️ ${timeString}` : timeString;
};

// Calculate potential yield for an auction tile
const calculatePotentialYield = (
  location: number, 
  lands: (PonziLand | null)[], 
  prices: TokenPrice[],
  activeAuctions: Record<number, PonziLandAuction>
): number => {
  const neighbors = getNeighborLocations(location);
  let potentialYield = 0;

  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const { symbol, ratio } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, symbol, ratio);
      const neighborTaxRate = getTaxRate(neighbor.level, Number(neighbor.location));
      potentialYield += neighborPriceESTRK * neighborTaxRate;
    }
  });

  return potentialYield;
};

// Format yield with appropriate precision
const formatYield = (yield_: number): string => {
  if (yield_ === 0) return '0/h';
  if (yield_ < 0.01) return '< 0.01/h';
  return `+${yield_.toFixed(2)}/h`;
};

// Calculate elapsed time in seconds
const getElapsedSeconds = (auction: PonziLandAuction): number => {
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = parseInt(auction.start_time);
  return Math.max(0, currentTime - startTime);
};

// --- Auction price decay logic from PonziLand contract ---
const DECIMALS_FACTOR = 1_000_000_000_000_000_000n;
const AUCTION_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds (604,800)
const LINEAR_DECAY_TIME = 10 * 60 * 20; // 12,000 game seconds. With TIME_SPEED=5, this phase is 40 real-world minutes.
const DROP_RATE = 90n; // 90% drop target over linear phase
const RATE_DENOMINATOR = 100n; // For percentage calculations
const SCALING_FACTOR = 50n;
const TIME_SPEED = 5n; // Corrected to match contract

function getCurrentAuctionPriceDecayRate(
  startTime: bigint,
  startPrice: bigint,
  floorPrice: bigint,
  decayRate: bigint,
  currentTime: bigint
): bigint {
  // Calculate time passed, scaled by TIME_SPEED
  const timePassed = currentTime > startTime
    ? (currentTime - startTime) * TIME_SPEED
    : 0n;

  // If auction duration exceeded, price is 0
  if (timePassed >= BigInt(AUCTION_DURATION)) {
    return 0n;
  }

  let currentPrice = startPrice;

  // --- Linear phase ---
  if (timePassed <= BigInt(LINEAR_DECAY_TIME)) {
    const timeFraction = timePassed * DECIMALS_FACTOR / BigInt(LINEAR_DECAY_TIME);
    const linearFactor = DECIMALS_FACTOR - (DROP_RATE * timeFraction / RATE_DENOMINATOR);
    currentPrice = startPrice * linearFactor / DECIMALS_FACTOR;
  } else {
    // --- Quadratic phase ---
    const remainingRate = RATE_DENOMINATOR - DROP_RATE;
    const priceAfterLinear = startPrice * remainingRate / RATE_DENOMINATOR;

    const progressTime = timePassed * DECIMALS_FACTOR / BigInt(AUCTION_DURATION);

    // k is the decay rate (adjusted by DECIMALS_FACTOR for scaling)
    const k = decayRate * DECIMALS_FACTOR / SCALING_FACTOR;

    // Calculate the denominator (1 + k * t) using scaled values for precision
    const denominator = DECIMALS_FACTOR + (k * progressTime / DECIMALS_FACTOR);

    // Calculate the decay factor using the formula (1 / (1 + k * t))^2
    let decayFactor: bigint;
    if (denominator !== 0n) {
      const temp = (DECIMALS_FACTOR * DECIMALS_FACTOR) / denominator;
      decayFactor = (temp * temp) / DECIMALS_FACTOR;
    } else {
      decayFactor = 0n;
    }

    currentPrice = priceAfterLinear * decayFactor / DECIMALS_FACTOR;
  }

  return currentPrice > floorPrice ? currentPrice : floorPrice;
}

function calculateAuctionPrice(auction: PonziLandAuction): number {
  const startPrice = BigInt(auction.start_price);
  const floorPrice = auction.floor_price ? BigInt(auction.floor_price) : 0n;
  const decayRate = BigInt(auction.decay_rate);
  const startTime = BigInt(parseInt(auction.start_time, 16));
  const currentTime = BigInt(Math.floor(Date.now() / 1000));

  const price = getCurrentAuctionPriceDecayRate(startTime, startPrice, floorPrice, decayRate, currentTime);
  return Number(price) / Number(DECIMALS_FACTOR);
}

const AuctionElapsedInfo = styled.div`
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

const TileInfoPanelWrapper = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  padding: 12px;
  border-radius: 8px;
  color: white;
  z-index: 1001;
  width: 260px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 12px;
  text-align: left;

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #7cb3ff;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 8px;
    font-size: 15px;
  }

  h4 {
    font-size: 13px;
    color: #aacfff;
    margin-top: 0;
    margin-bottom: 6px;
    text-align: left;
  }

  p {
    margin: 6px 0;
    line-height: 1.4;
  }

  strong {
    color: #a0cfff;
  }

  .info-section {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .info-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .close-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #999;
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
    padding: 3px;
  }
  .close-button:hover {
    color: white;
  }
`;

const InfoLine = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px; /* Small gap between lines */

  span:first-child {
    font-weight: bold;
    color: #a0cfff; /* Label color */
  }
  span:last-child {
    text-align: right;
  }
`;

const SQL_API_URL = import.meta.env.VITE_SQL_API_URL;

const SQL_GET_PONZI_LANDS = `SELECT location, token_used, sell_price, owner, level FROM "ponzi_land-Land"`;
const SQL_GET_PONZI_LAND_AUCTIONS = `SELECT land_location, floor_price, start_time, start_price, decay_rate, is_finished FROM "ponzi_land-Auction"`;
const SQL_GET_PONZI_LANDS_STAKE = `SELECT location, amount FROM "ponzi_land-LandStake"`;

const PonzilandMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [prices, setPrices] = useState<TokenPrice[]>([]);

  // New state for SQL fetched data
  const [landsSqlData, setLandsSqlData] = useState<PonziLand[]>([]);
  const [auctionsSqlData, setAuctionsSqlData] = useState<PonziLandAuction[]>([]);
  const [stakesSqlData, setStakesSqlData] = useState<PonziLandStake[]>([]);
  const [loadingSql, setLoadingSql] = useState(true);
  const [errorSql, setErrorSql] = useState<string | null>(null);
  
  const [gridData, setGridData] = useState<{
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
  }>({ tiles: [], activeRows: [], activeCols: [] });
  const [isPriceMinimized, setIsPriceMinimized] = useState(false);
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});
  const [selectedPlayerAddresses, setSelectedPlayerAddresses] = useState<Set<string>>(new Set());
  const [isPlayerListMinimized, setIsPlayerListMinimized] = useState(false);
  const [isZoomMinimized, setIsZoomMinimized] = useState(false);
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});
  const [allPlayers, setAllPlayers] = useState<Array<{ address: string; displayName: string; originalAddress: string }>>([]);
  const [selectedTileData, setSelectedTileData] = useState<SelectedTileDetails | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/price');
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices(); // Initial fetch
    const interval = setInterval(fetchPrices, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchSql = async <T,>(query: string, queryName: string): Promise<T[]> => {
      const encodedQuery = encodeURIComponent(query);
      const fullUrl = `${SQL_API_URL}?query=${encodedQuery}`;

      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SQL Query HTTP Error for ${queryName}`, {
            status: response.status,
            statusText: response.statusText,
            url: fullUrl,
            errorResponseText: errorText,
          });
          throw new Error(`SQL HTTP Error (${queryName}): ${response.status} ${response.statusText}. Details: ${errorText.substring(0, 200)}`);
        }
        const result = await response.json();
        return result as T[]; 
      } catch (error: any) {
        console.error(`Full error in fetchSql for ${queryName} (URL: ${fullUrl}):`, error);
        const errorMessage = error.message || `An unexpected error occurred in fetchSql for ${queryName}.`;
        throw new Error(errorMessage);
      }
    };

    const fetchAllSqlData = async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setLoadingSql(true);
      }
      setErrorSql(null);

      try {
        const [landsResult, auctionsResult, stakesResult] = await Promise.all([
          fetchSql<PonziLand>(SQL_GET_PONZI_LANDS, "GetPonziLands"),
          fetchSql<PonziLandAuction>(SQL_GET_PONZI_LAND_AUCTIONS, "GetPonziLandAuctions"),
          fetchSql<PonziLandStake>(SQL_GET_PONZI_LANDS_STAKE, "GetPonziLandsStake"),
        ]);
        
        setLandsSqlData(landsResult || []);
        setAuctionsSqlData(auctionsResult || []);
        setStakesSqlData(stakesResult || []);

      } catch (err: any) {
        console.error('Error in fetchAllSqlData:', err);
        setErrorSql(err.message || 'Failed to fetch one or more SQL datasets');
      } finally {
        if (isInitialLoad) {
          setLoadingSql(false);
        }
      }
    };

    fetchAllSqlData(true); // Initial fetch with loading indicator
    const intervalId = setInterval(() => fetchAllSqlData(false), 5000); // Polls without full loading indicator

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (landsSqlData && stakesSqlData && landsSqlData.length > 0) {
      setGridData(processGridData(landsSqlData, stakesSqlData));
    } else if (!loadingSql && landsSqlData && landsSqlData.length === 0) {
       setGridData({ tiles: Array(GRID_SIZE * GRID_SIZE).fill(null), activeRows: [], activeCols: [] });
    }
  }, [landsSqlData, stakesSqlData, loadingSql]);

  useEffect(() => {
    if (auctionsSqlData) {
      const filteredAuctions = auctionsSqlData
        .filter((auction: PonziLandAuction) => !auction.is_finished)
        .reduce((acc: Record<number, PonziLandAuction>, auction: PonziLandAuction) => {
          acc[Number(auction.land_location)] = auction;
          return acc;
        }, {});
      setActiveAuctions(filteredAuctions);
    }
  }, [auctionsSqlData]);

  useEffect(() => {
    document.title = "Ponziland ROI Map";
  }, []);

  useEffect(() => {
    if (gridData.tiles.length === 0 && !loadingSql) {
      setAllPlayers([]);
      return;
    }

    const ownerAddressesFromMap = new Set<string>();
    gridData.tiles.forEach(tile => {
      if (tile?.owner) {
        ownerAddressesFromMap.add(tile.owner);
      }
    });

    const addressesToFetchUsernamesFor: string[] = [];
    
    ownerAddressesFromMap.forEach(mapOwnerAddr => {
      if (!usernameCache[mapOwnerAddr.toLowerCase()]) {
        addressesToFetchUsernamesFor.push(mapOwnerAddr);
      }
    });
    
    if (addressesToFetchUsernamesFor.length > 0) {
      const fetchUsernamesForSpecificAddresses = async () => {
        try {
          const response = await fetch('/api/usernames', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: addressesToFetchUsernamesFor }),
          });
          if (response.ok) {
            const fetchedData = await response.json();
            setUsernameCache(prevCache => {
              const newCache = { ...prevCache };
              if (Array.isArray(fetchedData)) {
                fetchedData.forEach((item: {username: string, address: string}) => {
                  if (item.address && item.username) {
                    newCache[item.address.toLowerCase()] = item.username;
                  }
                });
              } else {
                Object.assign(newCache, fetchedData);
              }
              return newCache;
            });
          } else {
            // console.error("Failed to fetch usernames:", await response.text());
          }
        } catch (error) {
          // console.error("Error fetching usernames:", error);
        }
      };
      fetchUsernamesForSpecificAddresses();
    }

    const uniqueOwnerEntriesForPlayerList = new Map<string, { address: string; displayName: string; originalAddress: string }>();
    ownerAddressesFromMap.forEach(mapOwnerAddr => {
      const addrKey = mapOwnerAddr.toLowerCase();
      const username = usernameCache[addrKey];
      if (!uniqueOwnerEntriesForPlayerList.has(addrKey)) {
          uniqueOwnerEntriesForPlayerList.set(addrKey, {
            address: addrKey,
            originalAddress: mapOwnerAddr, 
            displayName: username || `${mapOwnerAddr.slice(0,6)}...${mapOwnerAddr.slice(-4)}`
        });
      }
    });

    const sortedPlayers = Array.from(uniqueOwnerEntriesForPlayerList.values()).sort((a,b) => a.displayName.localeCompare(b.displayName));
    setAllPlayers(sortedPlayers);

  }, [gridData.tiles, usernameCache, loadingSql]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  if (loadingSql) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>Loading Ponziland Data...</div>;
  if (errorSql && landsSqlData.length === 0) { 
    return <div style={{ color: 'red', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>Error loading data: {errorSql}</div>;
  }

  const handlePlayerSelectionChange = (address: string, isSelected: boolean) => {
    setSelectedPlayerAddresses(prevSelected => {
      const newSelected = new Set(prevSelected);
      const addrKey = address.toLowerCase(); // Use toLowerCase for Set consistency
      if (isSelected) {
        newSelected.add(addrKey);
      } else {
        newSelected.delete(addrKey);
      }
      return newSelected;
    });
  };

  const handleTileClick = (tileDetails: SelectedTileDetails) => {
    setSelectedTileData(tileDetails);
  };

  return (
    <MapWrapper ref={mapRef}>
      {errorSql && !loadingSql && landsSqlData.length > 0 && 
        <div style={{
          position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255, 0, 0, 0.7)', color: 'white', padding: '5px 10px', 
          borderRadius: '5px', zIndex: 2000, fontSize: '12px'
        }}>
          Update failed: {errorSql.length > 50 ? errorSql.substring(0,50)+"..." : errorSql} (showing previous data)
        </div>
      }
      <PlayerListPanel $isMinimized={isPlayerListMinimized}>
        <PanelHeader
          $isMinimized={isPlayerListMinimized}
          onClick={() => setIsPlayerListMinimized(!isPlayerListMinimized)}
        >
          Players
          <MinimizeButton>
            {isPlayerListMinimized ? '+' : '−'}
          </MinimizeButton>
        </PanelHeader>
        <PlayerListContent className="player-list-content">
          {allPlayers.map(player => {
            return (
              <label key={player.address}> 
                <input 
                  type="checkbox" 
                  checked={selectedPlayerAddresses.has(player.address)}
                  onChange={(e) => handlePlayerSelectionChange(player.originalAddress, e.target.checked)}
                />
                {player.displayName} 
                <span className="player-address">({player.originalAddress.slice(0,4)}...{player.originalAddress.slice(-3)})</span> 
              </label>
            );
          })}
          {allPlayers.length === 0 && !loadingSql && <p style={{textAlign: 'center', fontSize: '11px', color: '#888'}}>
             No players found on map.
            </p>}
          {allPlayers.length === 0 && loadingSql && <p style={{textAlign: 'center', fontSize: '11px', color: '#888'}}>
             Loading players...
            </p>}
        </PlayerListContent>
      </PlayerListPanel>
      <ZoomControls $isMinimized={isZoomMinimized}>
        <PanelHeader
          $isMinimized={isZoomMinimized}
          onClick={() => setIsZoomMinimized(!isZoomMinimized)}
        >
          Zoom
          <MinimizeButton>
            {isZoomMinimized ? '+' : '−'}
          </MinimizeButton>
        </PanelHeader>
        <div className="zoom-controls">
          <ZoomControlsRow>
            <ZoomButton onClick={() => handleZoom(-0.1)}>−</ZoomButton>
            <ZoomLevel>{Math.round(zoom * 100)}%</ZoomLevel>
            <ZoomButton onClick={() => handleZoom(0.1)}>+</ZoomButton>
          </ZoomControlsRow>
        </div>
      </ZoomControls>

      <GridContainer
        zoom={zoom}
        style={{
          gridTemplateColumns: `repeat(${gridData.activeCols.length}, 100px)`,
          gridTemplateRows: `repeat(${gridData.activeRows.length}, 100px)`
        }}
      >
         {gridData.activeRows.map(row =>
          gridData.activeCols.map(col => {
            const location = row * GRID_SIZE + col;
            const land = gridData.tiles[location];
            const auction = activeAuctions[location];
            const isHighlighted = land?.owner ? selectedPlayerAddresses.has(land.owner.toLowerCase()) : false;
            const { symbol, ratio } = getTokenInfo(land?.token_used || '', prices);
            
            const taxInfo = calculateTaxInfo(location, gridData.tiles, prices, activeAuctions);
            const landPriceESTRK = land ? convertToESTRK(land.sell_price, symbol, ratio) : 0;
            const valueColor = land ? getValueColor(
              land.sell_price, 
              taxInfo.profitPerHour
            ) : '#1a1a1a';
            
            const opportunityColor = getOpportunityColor(taxInfo.profitPerHour, landPriceESTRK);
            const burnRate = land ? calculateBurnRate(land, gridData.tiles, activeAuctions) : 0;
            const nukableStatus = land ? isNukable(land, burnRate) : false;
            const potentialYieldAuction = auction ? calculatePotentialYield(Number(land?.location), gridData.tiles, prices, activeAuctions) : undefined;

            // Add auctionROI calculation
            let auctionROIForDetails: number | undefined = undefined;
            let currentAuctionPriceForTileDisplay: number | undefined = undefined;

            if (auction) {
                currentAuctionPriceForTileDisplay = calculateAuctionPrice(auction);
                const currentYield = potentialYieldAuction || 0;
                // Only calculate and show ROI if price is positive and yield is positive
                if (currentAuctionPriceForTileDisplay > 0 && currentYield > 0) {
                    auctionROIForDetails = (currentYield / currentAuctionPriceForTileDisplay) * 100;
                }
            }

            const currentTileDetails: SelectedTileDetails = {
              location,
              coords: displayCoordinates(col, row),
              land,
              auction,
              taxInfo,
              symbol,
              ratio,
              landPriceESTRK,
              valueColor,
              opportunityColor,
              isMyLand: isHighlighted,
              burnRate,
              nukableStatus,
              potentialYieldAuction,
              auctionROI: auctionROIForDetails
            };

            return (
              <Tile
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                onClick={() => handleTileClick(currentTileDetails)}
                $isMyLand={isHighlighted}
                $level={getLevelNumber(land?.level)} 
                $isEmpty={!land}
                $valueColor={valueColor}
                $isAuction={!!auction}
                $opportunityColor={opportunityColor}
                $isNukable={nukableStatus}
                $auctionYield={potentialYieldAuction}
              >
                <TileLocation>{displayCoordinates(col, row)}</TileLocation>
                {land && (
                  auction ? (
                    <>
                      <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
                      <TileHeader>AUCTION</TileHeader>
                      <CompactTaxInfo>
                        <div>Yield: {formatYield(potentialYieldAuction || 0)}</div>
                        <div>{currentAuctionPriceForTileDisplay !== undefined ? currentAuctionPriceForTileDisplay.toFixed(2) : 'N/A'} nftSTRK</div>
                        {auctionROIForDetails !== undefined && (
                          <div style={{ color: auctionROIForDetails > 0 ? '#4CAF50' : (auctionROIForDetails < 0 ? '#ff6b6b' : 'white') }}>
                            ROI: {auctionROIForDetails.toFixed(1)}%/h
                          </div>
                        )}
                      </CompactTaxInfo>
                      <AuctionElapsedInfo>
                        {(() => {
                          const elapsed = getElapsedSeconds(auction);
                          const hours = Math.floor(elapsed / 3600);
                          const minutes = Math.floor((elapsed % 3600) / 60);
                          if (hours > 0) {
                            return `${hours}h ${minutes}m`;
                          } else {
                            return `${minutes}m`;
                          }
                        })()}
                      </AuctionElapsedInfo>
                    </>
                  ) : (
                    <>
                      <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
                      <TileHeader>
                        {taxInfo.profitPerHour !== 0 ? 
                          `${taxInfo.profitPerHour > 0 ? '+' : ''}${taxInfo.profitPerHour.toFixed(1)}/h` :
                          symbol
                        }
                      </TileHeader>
                      <CompactTaxInfo>
                        {land.sell_price ? (
                          <>
                            <div>{formatOriginalPrice(land.sell_price)} {symbol}</div>
                            {symbol !== 'nftSTRK' && ratio !== null && (
                              <div>{calculateESTRKPrice(land.sell_price, ratio)} nftSTRK</div>
                            )}
                            {symbol !== 'nftSTRK' && ratio === null && (
                              <div>Price unavailable</div>
                            )}
                            {(taxInfo.taxPaid > 0 || taxInfo.taxReceived > 0) && (
                              <>
                                <div>
                                  {taxInfo.taxPaid > 0 && `-${taxInfo.taxPaid.toFixed(1)}`}
                                  {taxInfo.taxPaid > 0 && taxInfo.taxReceived > 0 && ' | '}
                                  {taxInfo.taxReceived > 0 && `+${taxInfo.taxReceived.toFixed(1)}`}
                                </div>
                                <div style={{ color: taxInfo.profitPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                  ROI: {calculateROI(taxInfo.profitPerHour, landPriceESTRK).toFixed(2)}%/h
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div>Not for sale</div>
                        )}
                      </CompactTaxInfo>
                      <StakedInfo $isNukable={nukableStatus}>
                        {formatTimeRemaining(hexToDecimal(land.staked_amount || '0x0') / burnRate)}
                      </StakedInfo>
                    </>
                  )
                )}
              </Tile>
            );
          })
        )}
      </GridContainer>
      <PriceDisplay $isMinimized={isPriceMinimized}>
        <PriceHeader 
          $isMinimized={isPriceMinimized}
          onClick={() => setIsPriceMinimized(!isPriceMinimized)}
        >
          Token Prices
          <MinimizeButton>
            {isPriceMinimized ? '+' : '−'}
          </MinimizeButton>
        </PriceHeader>
        {prices
          .filter(token => token.symbol !== 'nftSTRK')
          .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
          .map(token => (
            <PriceRow key={token.address}>
              <TokenSymbol>{token.symbol}</TokenSymbol>
              <TokenValue>
                {token.ratio !== null ? formatRatio(token.ratio) : 'N/A'} nftSTRK
              </TokenValue>
            </PriceRow>
          ))}
      </PriceDisplay>
      <GameLink href="https://play.ponzi.land/game" target="_blank" rel="noopener noreferrer">
        🎮 Play Ponziland
      </GameLink>

      {selectedTileData && (
        <TileInfoPanelWrapper>
          <button className="close-button" onClick={() => setSelectedTileData(null)}>&times;</button>
          <h3>
            {selectedTileData.coords} (L{selectedTileData.land ? getLevelNumber(selectedTileData.land.level) : 'N/A'}) 
            {selectedTileData.auction ? "- AUCTION" : 
              (selectedTileData.land?.owner ? 
                `- ${(usernameCache[selectedTileData.land.owner.toLowerCase()] || selectedTileData.land.owner.slice(0,4)+"..."+selectedTileData.land.owner.slice(-3))}` : 
                (selectedTileData.land ? "- Unowned" : "- Empty")
              )}
          </h3>
          
          {selectedTileData.isMyLand && <p style={{ color: 'gold', fontWeight: 'bold' }}>★ Highlighted Land {(selectedTileData.land?.owner && usernameCache[selectedTileData.land.owner.toLowerCase()]) || ''}</p>}

          {selectedTileData.land ? (
            <>
              {selectedTileData.auction ? (
                <div className="info-section">
                  <h4>Auction</h4>
                  <InfoLine>
                    <span>Price:</span>
                    <span>{calculateAuctionPrice(selectedTileData.auction).toFixed(2)} nftSTRK</span>
                  </InfoLine>
                  <InfoLine>
                    <span>Yield:</span>
                    <span style={{ color: (selectedTileData.potentialYieldAuction || 0) > 0 ? '#4CAF50' : 'white' }}>
                      {formatYield(selectedTileData.potentialYieldAuction || 0)}
                    </span>
                  </InfoLine>
                  {/* Display Auction ROI in Info Panel */}
                  {selectedTileData.auctionROI !== undefined && (
                    <InfoLine>
                      <span>ROI/hr:</span>
                      <span style={{ color: selectedTileData.auctionROI > 0 ? '#4CAF50' : (selectedTileData.auctionROI < 0 ? '#ff6b6b' : 'white')}}>
                        {selectedTileData.auctionROI.toFixed(1)}%
                      </span>
                    </InfoLine>
                  )}
                  <InfoLine>
                    <span>Ends In:</span>
                    <span>{(() => {
                      const elapsed = getElapsedSeconds(selectedTileData.auction);
                      const remaining = AUCTION_DURATION - elapsed;
                      if (remaining <=0) return "Ended";
                      const hours = Math.floor(remaining / 3600);
                      const minutes = Math.floor((remaining % 3600) / 60);
                      if (hours > 0) return `${hours}h ${minutes}m`;
                      return `${minutes}m`;
                    })()}</span>
                  </InfoLine>
                </div>
              ) : (
                <>
                  <div className="info-section">
                    <h4>Finances</h4>
                    <InfoLine>
                      <span>Profit/hr:</span>
                      <span style={{ color: selectedTileData.taxInfo.profitPerHour > 0 ? '#4CAF50' : (selectedTileData.taxInfo.profitPerHour < 0 ? '#ff6b6b' : 'white')}}>
                        {selectedTileData.taxInfo.profitPerHour > 0 ? '+':''}{selectedTileData.taxInfo.profitPerHour.toFixed(1)}/h
                      </span>
                    </InfoLine>
                    {selectedTileData.land.sell_price ? (
                      <>
                        <InfoLine>
                          <span>Price:</span>
                          <span>{formatOriginalPrice(selectedTileData.land.sell_price)} {selectedTileData.symbol}</span>
                        </InfoLine>
                        {selectedTileData.symbol !== 'nftSTRK' && selectedTileData.ratio !== null && (
                          <InfoLine>
                            <span>Value:</span>
                            <span>{calculateESTRKPrice(selectedTileData.land.sell_price, selectedTileData.ratio)} nftSTRK</span>
                          </InfoLine>
                        )}
                        {selectedTileData.landPriceESTRK > 0 && (
                           <InfoLine>
                            <span>ROI/hr:</span>
                            <span style={{ color: calculateROI(selectedTileData.taxInfo.profitPerHour, selectedTileData.landPriceESTRK) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                              {calculateROI(selectedTileData.taxInfo.profitPerHour, selectedTileData.landPriceESTRK).toFixed(1)}%
                            </span>
                          </InfoLine>
                        )}
                      </>
                    ) : (
                      <InfoLine>
                        <span>Price:</span>
                        <span>Not for sale</span>
                      </InfoLine>
                    )}
                  </div>

                  <div className="info-section">
                    <h4>Staking</h4>
                    <InfoLine>
                      <span>Staked:</span>
                      <span>{hexToDecimal(selectedTileData.land.staked_amount || '0x0').toFixed(2)} {selectedTileData.symbol}</span>
                    </InfoLine>
                    <InfoLine>
                      <span>Burn/hr:</span>
                      <span>{selectedTileData.burnRate > 0 ? selectedTileData.burnRate.toFixed(2) : '0.00'} {selectedTileData.symbol}</span>
                    </InfoLine>
                    <InfoLine>
                      <span>Time Left:</span>
                      <span style={{
                        color: selectedTileData.nukableStatus === 'nukable' ? '#ff6b6b' : (selectedTileData.nukableStatus === 'warning' ? 'orange' : '#4CAF50'),
                        fontWeight: selectedTileData.nukableStatus !== false ? 'bold' : 'normal'
                      }}>
                        {selectedTileData.burnRate > 0 ? formatTimeRemaining(hexToDecimal(selectedTileData.land.staked_amount || '0x0') / selectedTileData.burnRate) : (hexToDecimal(selectedTileData.land.staked_amount || '0x0') > 0 ? '∞ (no burn)' : 'N/A')}
                      </span>
                    </InfoLine>
                  </div>

                  {(selectedTileData.taxInfo.taxPaid > 0 || selectedTileData.taxInfo.taxReceived > 0) && (
                    <div className="info-section">
                      <h4>Tax Details</h4>
                      <InfoLine>
                        <span>Paid/hr:</span>
                        <span>-{selectedTileData.taxInfo.taxPaid.toFixed(1)}</span>
                      </InfoLine>
                      <InfoLine>
                        <span>Recv/hr:</span>
                        <span>+{selectedTileData.taxInfo.taxReceived.toFixed(1)}</span>
                      </InfoLine>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <p>This is an empty plot of land.</p>
          )}
        </TileInfoPanelWrapper>
      )}
    </MapWrapper>
  );
};

export default PonzilandMap; 
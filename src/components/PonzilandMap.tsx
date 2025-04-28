import { useQuery } from '@apollo/client';
import { GET_PONZI_LANDS, GET_PONZI_LAND_AUCTIONS, GET_PONZI_LANDS_STAKE } from '../graphql/queries';
import { PonziLand, PonziLandAuction, PonziLandStake } from '../types/ponziland';
import styled from 'styled-components';
import { useEffect, useState, useRef } from 'react';

const MY_ADDRESS = '0x4364d8e9f994453f5d0c8dc838293226d8ae0aec78030e5ee5fb91614b00eb5';

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
    return props.$valueColor;
  }};
  border: ${props => {
    if (props.$isMyLand) {
      return '3px solid gold';
    }
    if (props.$isAuction) {
      const yield_ = props.$auctionYield || 0;
      if (yield_ >= 50) {
        return '2px solid rgba(204, 102, 204, 1)'; // Thicker border for very high yield
      }
      const alpha = Math.min(0.3 + (yield_ / 30) * 0.7, 1.0); // Scale from 0.3 to 1.0 based on yield, max at 30
      return `1px solid rgba(204, 102, 204, ${alpha})`;
    }
    if (props.$isNukable === 'nukable') {
      return '2px solid #ff0000';
    }
    if (props.$isNukable === 'warning') {
      return '2px solid #ffa500';
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
        return '0 0 15px rgba(204, 102, 204, 1), 0 0 30px rgba(204, 102, 204, 0.7)'; // Enhanced glow for very high yield
      }
      const alpha = Math.min(0.2 + (yield_ / 30) * 0.8, 1.0); // Scale from 0.2 to 1.0 based on yield, max at 30
      return `0 0 10px rgba(204, 102, 204, ${alpha})`;
    }
    if (props.$isNukable === 'nukable') {
      return '0 0 10px rgba(255, 0, 0, 0.3)';
    }
    if (props.$isNukable === 'warning') {
      return '0 0 10px rgba(255, 165, 0, 0.3)';
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

  // Create a map of stakes by location
  const stakesMap = stakes.reduce((acc, stake) => {
    acc[Number(stake.location)] = stake.amount;
    return acc;
  }, {} as Record<number, string>);

  // First pass: find the boundaries of the land area
  lands.forEach(land => {
    const location = Number(land.location);
    const [x, y] = getCoordinates(location);
    minRow = Math.min(minRow, Number(y));
    maxRow = Math.max(maxRow, Number(y));
    minCol = Math.min(minCol, Number(x));
    maxCol = Math.max(maxCol, Number(x));
  });

  // Second pass: fill the grid with lands and their stake amounts
  lands.forEach(land => {
    const location = Number(land.location);
    grid[location] = {
      ...land,
      staked_amount: stakesMap[location] || '0x0'
    };
  });

  // Create arrays of all rows and columns within the boundaries
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

const AddressInput = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  top: 20px;
  left: 20px;
  transform: none;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  min-width: 300px;
  transition: all 0.3s ease;
  
  ${props => props.$isMinimized && `
    min-width: unset;
    padding: 10px;
    cursor: pointer;
    
    input {
      display: none;
    }
  `}
`;

const AddressHeader = styled.div<{ $isMinimized: boolean }>`
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

const AddressField = styled.input`
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 8px 12px;
  color: white;
  font-family: monospace;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #7cb3ff;
  }
`;

const ZoomControls = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
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

interface TokenPrice {
  symbol: string;
  address: string;
  ratio: number | null;
  best_pool: any;
}

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

const formatRatio = (ratio: number): string => {
  if (ratio >= 1) {
    return ratio.toFixed(2);
  }
  // For small numbers, calculate appropriate decimal places
  const decimalPlaces = Math.max(2, -Math.floor(Math.log10(ratio)) + 2);
  return ratio.toFixed(decimalPlaces);
};

const normalizeAddress = (address: string): string => {
  // Remove '0x0' prefix and replace with '0x'
  if (address.startsWith('0x0')) {
    return '0x' + address.slice(3);
  }
  return address;
};

const getTokenInfo = (address: string, prices: TokenPrice[]): { symbol: string; ratio: number | null } => {
  const normalizedAddress = normalizeAddress(address);
  const tokenInfo = prices.find(p => normalizeAddress(p.address) === normalizedAddress);
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
  if (!originalPrice || ratio === null) return '';
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

// Update value color to use grey-blue-green scheme based on yield
const getValueColor = (price: string | null, profitPerHour: number): string => {
  if (!price) return '#2a2a2a';  // No price = dark gray
  
  // Negative yield = dark red shades
  if (profitPerHour <= -20) return '#4d1515';  // Very negative yield = dark red
  if (profitPerHour <= -10) return '#4d2015';  // Highly negative yield = dark red-orange
  if (profitPerHour <= -5) return '#4d2515';   // Moderately negative yield = darker orange
  if (profitPerHour < 0) return '#4d3015';     // Slightly negative yield = dark orange
  
  // Positive yield = grey -> blue -> green progression (dark mode friendly)
  if (profitPerHour <= 5) return '#2d2d35';    // Very low yield = dark grey with slight blue tint
  if (profitPerHour <= 10) return '#2d2d40';   // Low yield = grey-blue
  if (profitPerHour <= 15) return '#1e2d4d';   // Low-medium yield = darker blue
  if (profitPerHour <= 20) return '#1b2d5d';   // Medium yield = medium blue
  if (profitPerHour <= 30) return '#1b3d6d';   // Medium-high yield = brighter blue
  if (profitPerHour <= 40) return '#1b4d4d';   // High yield = blue-green
  if (profitPerHour <= 50) return '#1b4d3d';   // Very high yield = forest green
  return '#1b4d2d';                            // Highest yield = rich green
};

interface TaxInfo {
  taxPaid: number;
  taxReceived: number;
  profitPerHour: number;
}

const getTaxRate = (level: string | undefined): number => {
  const baseRate = 0.05; // 5% baseline per neighbor
  if (!level) return baseRate;
  
  switch (level.toLowerCase()) {
    case 'first':  // Level 2: 10% reduction from baseline
      return baseRate * 0.9;  // 4.5%
    case 'second': // Level 3: 15% reduction from baseline
      return baseRate * 0.85; // 4.25%
    case 'zero':   // Level 1: baseline rate
      return baseRate;        // 5%
    default:
      return baseRate;        // Default to baseline rate
  }
};

const convertToESTRK = (price: string | null, symbol: string, ratio: number | null): number => {
  if (!price || symbol === 'eSTRK') return Number(formatOriginalPrice(price));
  return ratio ? Number(calculateESTRKPrice(price, ratio)) : 0;
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

  // Calculate current land's sale price in eSTRK
  const { symbol: mySymbol, ratio: myRatio } = getTokenInfo(currentLand.token_used, prices);
  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);

  // Calculate tax paid to neighbors based on our level's tax rate
  if (currentLand.sell_price) {
    const myTaxRate = getTaxRate(currentLand.level);
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      // Only pay tax if neighbor exists, is not on auction, and has an owner
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        taxPaid += myPriceESTRK * myTaxRate;
      }
    });
  }

  // Calculate tax received from neighbors based on their level's tax rate
  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    // Only receive tax if neighbor exists, is not on auction, has an owner and is for sale
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
      const neighborTaxRate = getTaxRate(neighbor.level);
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
  // Only consider ROI for lands earning more than 20 tokens per hour
  if (profitPerHour <= 20) return '#333';
  
  const roi = calculateROI(profitPerHour, landPriceESTRK);
  if (roi <= 100) return '#333';  // Require minimum 100% hourly ROI
  
  // Scale intensity based on ROI for high-yield lands
  // Max brightness at 400% ROI
  const intensity = Math.min((roi - 100) / 300, 1);
  
  return `rgba(0, 255, 255, ${intensity})`; // Cyan color for high ROI + high yield borders
};

const TaxInfo = styled.div`
  font-size: 10px;
  color: #aaa;
  text-align: center;
  margin-top: 2px;
`;

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
  const taxRate = getTaxRate(land.level);
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
  // Convert to minutes and check if less than or equal to 5 minutes
  const timeRemainingMinutes = timeRemainingHours * 60;
  
  return timeRemainingMinutes <= 5 ? 'warning' : false;
};

// Format time remaining showing only hours and minutes
const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) return 'NUKABLE';
  
  // Convert to minutes for better precision but round to whole minutes
  const totalMinutes = Math.round(hours * 60);
  
  // Calculate hours and remaining minutes
  const hoursLeft = Math.floor(totalMinutes / 60);
  const minutesLeft = totalMinutes % 60;
  
  // Add warning indicator for 5 minutes or less
  const timeString = hoursLeft === 0 ? `${minutesLeft}m` : `${hoursLeft}h ${minutesLeft}m`;
  return totalMinutes <= 5 ? `⚠️ ${timeString}` : timeString;
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
    // Only count yield from neighbors that exist, are not on auction, have an owner and are for sale
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const { symbol, ratio } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, symbol, ratio);
      const neighborTaxRate = getTaxRate(neighbor.level);
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
const AUCTION_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds
const LINEAR_DECAY_TIME = 10 * 60 * 20; // 10 minutes IRL (scaled by TIME_SPEED)
const DROP_RATE = 90n; // 90% drop over linear phase
const RATE_DENOMINATOR = 100n; // For percentage calculations
const SCALING_FACTOR = 50n;
const TIME_SPEED = 20n;

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

const PonzilandMap = () => {
  const { loading: landsLoading, error: landsError, data: landsData } = useQuery(GET_PONZI_LANDS, {
    pollInterval: 5000,
  });
  
  const { loading: auctionsLoading, error: auctionsError, data: auctionsData } = useQuery(GET_PONZI_LAND_AUCTIONS, {
    pollInterval: 5000,
  });

  const { loading: stakesLoading, error: stakesError, data: stakesData } = useQuery(GET_PONZI_LANDS_STAKE, {
    pollInterval: 5000,
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [gridData, setGridData] = useState<{
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
  }>({ tiles: [], activeRows: [], activeCols: [] });
  const [isPriceMinimized, setIsPriceMinimized] = useState(false);
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});
  const [userAddress, setUserAddress] = useState(MY_ADDRESS);
  const [isAddressMinimized, setIsAddressMinimized] = useState(false);
  const [isZoomMinimized, setIsZoomMinimized] = useState(false);

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
    if (landsData?.ponziLandLandModels?.edges && stakesData?.ponziLandLandStakeModels?.edges) {
      const lands = landsData.ponziLandLandModels.edges.map(
        (edge: { node: PonziLand }) => edge.node
      );
      const stakes = stakesData.ponziLandLandStakeModels.edges.map(
        (edge: { node: PonziLandStake }) => edge.node
      );
      setGridData(processGridData(lands, stakes));
    }
  }, [landsData, stakesData]);

  useEffect(() => {
    if (auctionsData?.ponziLandAuctionModels?.edges) {
      const auctions = auctionsData.ponziLandAuctionModels.edges
        .map((edge: { node: PonziLandAuction }) => edge.node)
        .filter((auction: PonziLandAuction) => !auction.is_finished)
        .reduce((acc: Record<number, PonziLandAuction>, auction: PonziLandAuction) => {
          acc[auction.land_location] = auction;
          return acc;
        }, {});
      setActiveAuctions(auctions);
    }
  }, [auctionsData]);

  useEffect(() => {
    document.title = "Ponziland ROI Map";
  }, []);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  if (landsLoading || auctionsLoading || stakesLoading) return <div>Loading...</div>;
  if (landsError || auctionsError || stakesError) 
    return <div>Error loading data: {landsError?.message || auctionsError?.message || stakesError?.message}</div>;

  return (
    <MapWrapper ref={mapRef}>
      <AddressInput $isMinimized={isAddressMinimized}>
        <AddressHeader 
          $isMinimized={isAddressMinimized}
          onClick={() => setIsAddressMinimized(!isAddressMinimized)}
        >
          Your Address
          <MinimizeButton>
            {isAddressMinimized ? '+' : '−'}
          </MinimizeButton>
        </AddressHeader>
        <AddressField
          type="text"
          value={userAddress}
          onChange={(e) => setUserAddress(e.target.value)}
          placeholder="Enter your address..."
        />
      </AddressInput>

      <ZoomControls $isMinimized={isZoomMinimized}>
        <AddressHeader 
          $isMinimized={isZoomMinimized}
          onClick={() => setIsZoomMinimized(!isZoomMinimized)}
        >
          Zoom
          <MinimizeButton>
            {isZoomMinimized ? '+' : '−'}
          </MinimizeButton>
        </AddressHeader>
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
            const isMyLand = land?.owner === userAddress;
            const { symbol, ratio } = getTokenInfo(land?.token_used || '', prices);
            
            const taxInfo = calculateTaxInfo(location, gridData.tiles, prices, activeAuctions);
            const landPriceESTRK = land ? convertToESTRK(land.sell_price, symbol, ratio) : 0;
            const valueColor = land ? getValueColor(
              land.sell_price, 
              taxInfo.profitPerHour
            ) : '#1a1a1a';
            
            const opportunityColor = getOpportunityColor(taxInfo.profitPerHour, landPriceESTRK);

            return (
              <Tile
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                $isMyLand={isMyLand}
                $level={getLevelNumber(land?.level)}
                $isEmpty={!land}
                $valueColor={valueColor}
                $isAuction={!!auction}
                $opportunityColor={opportunityColor}
                $isNukable={land ? isNukable(land, calculateBurnRate(land, gridData.tiles, activeAuctions)) : false}
                $auctionYield={auction ? calculatePotentialYield(Number(land?.location), gridData.tiles, prices, activeAuctions) : undefined}
              >
                <TileLocation>{displayCoordinates(col, row)}</TileLocation>
                {land && (
                  auction ? (
                    <>
                      <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
                      <TileHeader>AUCTION</TileHeader>
                      <CompactTaxInfo>
                        <div style={{ color: '#4CAF50' }}>Yield: {formatYield(calculatePotentialYield(Number(land.location), gridData.tiles, prices, activeAuctions))}</div>
                        <div>{calculateAuctionPrice(auction).toFixed(2)} eStrk</div>
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
                            {symbol !== 'eSTRK' && (
                              <div>{calculateESTRKPrice(land.sell_price, ratio)} eSTRK</div>
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
                      <StakedInfo $isNukable={land ? isNukable(land, calculateBurnRate(land, gridData.tiles, activeAuctions)) : false}>
                        {formatTimeRemaining(hexToDecimal(land.staked_amount || '0x0') / calculateBurnRate(land, gridData.tiles, activeAuctions))}
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
          .filter(token => token.symbol !== 'eSTRK')
          .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
          .map(token => (
            <PriceRow key={token.address}>
              <TokenSymbol>{token.symbol}</TokenSymbol>
              <TokenValue>
                {formatRatio(token.ratio || 0)} eSTRK
              </TokenValue>
            </PriceRow>
          ))}
      </PriceDisplay>
      <GameLink href="https://play.ponzi.land/game" target="_blank" rel="noopener noreferrer">
        🎮 Play Ponziland
      </GameLink>
    </MapWrapper>
  );
};

export default PonzilandMap; 
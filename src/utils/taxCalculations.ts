import { PonziLand, PonziLandAuction, TokenPrice, TaxInfo, YieldInfo } from '../types/ponziland';
import { TAX_RATE_RAW, TIME_SPEED_FACTOR } from '../constants/ponziland';
import { getNeighborLocations } from './dataProcessing';
import { getTokenInfo, getTokenInfoCached, convertToESTRK, hexToDecimal } from './formatting';

export const getTaxRate = (level: string | undefined, locationNum: number): number => {
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

export const calculateTaxInfo = (
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

export const calculateROI = (profitPerHour: number, landPriceESTRK: number): number => {
  if (landPriceESTRK <= 0) return 0;
  // ROI = (profit per hour / purchase price) × 100
  // Only the purchase price is considered as the investment
  return (profitPerHour / landPriceESTRK) * 100;
};

export const calculateBurnRate = (land: PonziLand | null, lands: (PonziLand | null)[], activeAuctions: Record<number, PonziLandAuction>): number => {
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

export const isNukable = (land: PonziLand | null, burnRate: number): 'nukable' | 'warning' | false => {
  if (!land) return false;
  const stakedAmount = hexToDecimal(land.staked_amount || '0x0');
  if (stakedAmount <= 0) return 'nukable';
  
  // Calculate time remaining in hours
  const timeRemainingHours = stakedAmount / burnRate;
  // Convert to minutes and check if less than or equal to 10 minutes
  const timeRemainingMinutes = timeRemainingHours * 60;
  
  return timeRemainingMinutes <= 10 ? 'warning' : false;
};

export const calculatePotentialYield = (
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

export const calculateTimeRemainingHours = (land: PonziLand | null, burnRate: number): number => {
  if (!land || burnRate <= 0) return Infinity;
  const stakedAmount = hexToDecimal(land.staked_amount || '0x0');
  if (stakedAmount <= 0) return 0;
  return stakedAmount / burnRate;
};

export const calculateTotalYieldInfo = (
  location: number,
  lands: (PonziLand | null)[],
  prices: TokenPrice[],
  activeAuctions: Record<number, PonziLandAuction>
): { totalYield: number; yieldPerHour: number; taxPaidTotal: number } => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { totalYield: 0, yieldPerHour: 0, taxPaidTotal: 0 };
  }

  const neighbors = getNeighborLocations(location);
  const { symbol: mySymbol, ratio: myRatio } = getTokenInfo(currentLand.token_used, prices);
  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);
  
  let totalYieldReceived = 0;
  let yieldPerHourReceived = 0;
  let totalTaxPaid = 0;
  let yieldPerHourPaid = 0;

  // Calculate our own time remaining first (needed for both tax calculations)
  const myBurnRate = calculateBurnRate(currentLand, lands, activeAuctions);
  const myTimeRemaining = calculateTimeRemainingHours(currentLand, myBurnRate);

  // Calculate tax received from neighbors (considering both our time and their nuke times)
  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      // Calculate neighbor's burn rate and time remaining first
      const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
      const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
      
      // Only include neighbors that have stake left (not already nuked)
      if (neighborTimeRemaining > 0) {
        const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfo(neighbor.token_used, prices);
        const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
        const neighborTaxRate = getTaxRate(neighbor.level, Number(neighbor.location));
        const neighborHourlyTax = neighborPriceESTRK * neighborTaxRate;
        
        yieldPerHourReceived += neighborHourlyTax;
        
        // We receive tax for the minimum of: our remaining time OR neighbor's remaining time
        // (if we get nuked, we stop receiving; if neighbor gets nuked, they stop paying)
        const taxReceivingDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
        totalYieldReceived += neighborHourlyTax * taxReceivingDuration;
      }
    }
  });

  // Calculate tax paid to neighbors (considering both our time and each neighbor's time)
  if (currentLand.sell_price) {
    const myTaxRate = getTaxRate(currentLand.level, Number(currentLand.location));
    
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        // Calculate neighbor's time remaining first
        const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        // Only pay tax to neighbors that have stake left (not already nuked)
        if (neighborTimeRemaining > 0) {
          const hourlyTaxPaid = myPriceESTRK * myTaxRate;
          yieldPerHourPaid += hourlyTaxPaid;
          
          // We pay tax for the minimum of: our remaining time OR neighbor's remaining time
          // (whichever ends first stops the tax payment)
          const taxPaymentDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
          totalTaxPaid += hourlyTaxPaid * taxPaymentDuration;
        }
      }
    });
  }

  // Calculate net profit: total yield received minus total tax paid minus land purchase price
  const netYield = totalYieldReceived - totalTaxPaid - myPriceESTRK;

  return {
    totalYield: netYield,
    yieldPerHour: yieldPerHourReceived - yieldPerHourPaid,
    taxPaidTotal: totalTaxPaid
  };
};

// Performance optimized versions using caches
export const getTaxRateCached = (level: string | undefined, locationNum: number, neighborCache: Map<number, number[]>): number => {
  const neighbors = neighborCache.get(locationNum) || [];
  const numCardinalNeighbors = neighbors.length;

  if (numCardinalNeighbors === 0) {
    return 0;
  }

  const baseRate = (TAX_RATE_RAW / 100.0) * TIME_SPEED_FACTOR / numCardinalNeighbors;
  
  let discountedRate = baseRate;
  if (level) {
    switch (level.toLowerCase()) {
      case 'first':
        discountedRate = baseRate * 0.9;
        break;
      case 'second':
        discountedRate = baseRate * 0.85;
        break;
      case 'zero':
      default:
        break;
    }
  }
  return discountedRate;
};

export const calculateTaxInfoCached = (
  location: number,
  lands: (PonziLand | null)[],
  tokenCache: Map<string, { symbol: string; ratio: number | null }>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>
): TaxInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { taxPaid: 0, taxReceived: 0, profitPerHour: 0 };
  }

  const neighbors = neighborCache.get(location) || [];
  let taxPaid = 0;
  let taxReceived = 0;

  const { symbol: mySymbol, ratio: myRatio } = getTokenInfoCached(currentLand.token_used, tokenCache);
  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);

  if (currentLand.sell_price) {
    const myTaxRate = getTaxRateCached(currentLand.level, Number(currentLand.location), neighborCache);
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
      const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfoCached(neighbor.token_used, tokenCache);
      const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
      const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
      taxReceived += neighborPriceESTRK * neighborTaxRate;
    }
  });

  return {
    taxPaid,
    taxReceived,
    profitPerHour: taxReceived - taxPaid
  };
};

export const calculateTotalYieldInfoCached = (
  location: number,
  lands: (PonziLand | null)[],
  tokenCache: Map<string, { symbol: string; ratio: number | null }>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>
): YieldInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { totalYield: 0, yieldPerHour: 0, taxPaidTotal: 0 };
  }

  const neighbors = neighborCache.get(location) || [];
  const { symbol: mySymbol, ratio: myRatio } = getTokenInfoCached(currentLand.token_used, tokenCache);

  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);
  
  console.log(myPriceESTRK);

  let totalYieldReceived = 0;
  let yieldPerHourReceived = 0;
  let totalTaxPaid = 0;
  let yieldPerHourPaid = 0;

  const myBurnRate = calculateBurnRate(currentLand, lands, activeAuctions);
  const myTimeRemaining = calculateTimeRemainingHours(currentLand, myBurnRate);

  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
      const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
      
      if (neighborTimeRemaining > 0) {
        const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfoCached(neighbor.token_used, tokenCache);
        const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
        const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
        const neighborHourlyTax = neighborPriceESTRK * neighborTaxRate;
        
        yieldPerHourReceived += neighborHourlyTax;
        const taxReceivingDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
        totalYieldReceived += neighborHourlyTax * taxReceivingDuration;
      }
    }
  });

  if (currentLand.sell_price) {
    const myTaxRate = getTaxRateCached(currentLand.level, Number(currentLand.location), neighborCache);
    
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        if (neighborTimeRemaining > 0) {
          const hourlyTaxPaid = myPriceESTRK * myTaxRate;
          yieldPerHourPaid += hourlyTaxPaid;
          const taxPaymentDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
          totalTaxPaid += hourlyTaxPaid * taxPaymentDuration;
        }
      }
    });
  }
  console.log(totalYieldReceived);
  console.log(totalTaxPaid);
  console.log(myPriceESTRK);
  const netYield = totalYieldReceived - totalTaxPaid - myPriceESTRK;

  return {
    totalYield: netYield,
    yieldPerHour: yieldPerHourReceived - yieldPerHourPaid,
    taxPaidTotal: totalTaxPaid
  };
}; 
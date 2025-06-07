import { PonziLand, PonziLandAuction, TokenPrice, TaxInfo, YieldInfo } from '../types/ponziland';
import { TAX_RATE_RAW, TIME_SPEED_FACTOR } from '../constants/ponziland';
import { getNeighborLocations } from './dataProcessing';
import { getTokenInfo, getTokenInfoCached, convertToESTRK, hexToDecimal } from './formatting';
import { performanceCache } from './performanceCache';

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
  if (!land.location) return 0;
  
  const location = parseInt(land.location);
  return performanceCache.getTimeRemaining(location, () => {
    const stakedAmount = hexToDecimal(land.staked_amount || '0x0');
    if (stakedAmount <= 0) return 0;
    return stakedAmount / burnRate;
  });
};

// Performance optimized versions using caches
export const getTaxRateCached = (level: string | undefined, locationNum: number, neighborCache: Map<number, number[]>): number => {
  return performanceCache.getTaxRate(level || 'zero', locationNum, () => {
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
  });
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

  const { symbol: mySymbol, ratio: myRatio } = getTokenInfoCached(currentLand.token_used, tokenCache);
  const myPriceESTRK = convertToESTRK(currentLand.sell_price, mySymbol, myRatio);
  const myBurnRate = calculateBurnRate(currentLand, lands, activeAuctions);
  const myTimeRemaining = calculateTimeRemainingHours(currentLand, myBurnRate);

  // Calculate yield received from neighbors (constrained by our duration)
  const neighborYields = calculateNeighborYields(
    location, lands, tokenCache, neighborCache, activeAuctions, 
    true, // constrainToMyDuration = true
    myTimeRemaining,
    12 // Use default 12h cap for existing calculations
  );

  // Calculate tax paid to neighbors
  let totalTaxPaid = 0;
  let yieldPerHourPaid = 0;
  
  if (currentLand.sell_price) {
    const myTaxRate = getTaxRateCached(currentLand.level, Number(currentLand.location), neighborCache);
    const neighbors = neighborCache.get(location) || [];
    
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

  const netYield = neighborYields.totalYield - totalTaxPaid - myPriceESTRK;

  return {
    totalYield: netYield,
    yieldPerHour: neighborYields.yieldPerHour - yieldPerHourPaid,
    taxPaidTotal: totalTaxPaid
  };
};

// Refactored function to calculate neighbor yields with optional constraints
export const calculateNeighborYields = (
  location: number,
  lands: (PonziLand | null)[],
  tokenCache: Map<string, { symbol: string; ratio: number | null }>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  constrainToMyDuration: boolean = true,
  myTimeRemaining?: number,
  durationCapHours: number = 12
): { 
  yieldPerHour: number; 
  totalYield: number; 
  longestNeighborDuration: number;
  neighborDetails: Array<{
    location: number;
    priceESTRK: number;
    taxRate: number;
    hourlyYield: number;
    timeRemaining: number;
    totalYieldFromThisNeighbor: number;
    symbol: string;
  }>;
} => {
  return performanceCache.getNeighborYield(
    location, 
    constrainToMyDuration, 
    myTimeRemaining, 
    durationCapHours,
    () => {
      const neighbors = neighborCache.get(location) || [];
      let yieldPerHour = 0;
      let longestNeighborDuration = 0;
      let totalYield = 0;
  const neighborDetails = [] as Array<{
    location: number;
    priceESTRK: number;
    taxRate: number;
    hourlyYield: number;
    timeRemaining: number;
    totalYieldFromThisNeighbor: number;
    symbol: string;
  }>;

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
        
        // Calculate yield duration - either constrained by our duration or until neighbor gets nuked
        const yieldDuration = constrainToMyDuration && myTimeRemaining !== undefined
          ? Math.min(myTimeRemaining, neighborTimeRemaining, durationCapHours)
          : Math.min(neighborTimeRemaining, durationCapHours);
        
        const totalYieldFromThisNeighbor = neighborHourlyTax * yieldDuration;

        yieldPerHour += neighborHourlyTax;
        longestNeighborDuration = Math.max(longestNeighborDuration, neighborTimeRemaining);
        totalYield += totalYieldFromThisNeighbor;
        
        neighborDetails.push({
          location: neighborLoc,
          priceESTRK: neighborPriceESTRK,
          taxRate: neighborTaxRate,
          hourlyYield: neighborHourlyTax,
          timeRemaining: neighborTimeRemaining,
          totalYieldFromThisNeighbor,
          symbol: neighborSymbol
        });
      }
    }
  });

  return {
    yieldPerHour,
    totalYield,
    longestNeighborDuration,
    neighborDetails
  };
  });
};

// Calculate comprehensive purchase recommendations
export const calculatePurchaseRecommendation = (
  location: number,
  currentLand: PonziLand | null,
  lands: (PonziLand | null)[],
  tokenCache: Map<string, { symbol: string; ratio: number | null }>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  currentAuctionPrice?: number,
  durationCapHours: number = 12
): {
  currentPrice: number;
  maxYield: number;
  recommendedPrice: number;
  requiredTaxPerHour: number;
  requiredTotalTax: number;
  requiredStakeForFullYield: number;
  yieldDuration: number;
  neighborCount: number;
  isRecommended: boolean;
  recommendationReason: string;
  symbol: string;
  neighborDetails: Array<{
    location: number;
    priceESTRK: number;
    hourlyYield: number;
    timeRemaining: number;
    symbol: string;
  }>;
} => {
  if (!currentLand) {
    return {
      currentPrice: 0,
      maxYield: 0,
      recommendedPrice: 0,
      requiredTaxPerHour: 0,
      requiredTotalTax: 0,
      requiredStakeForFullYield: 0,
      yieldDuration: 0,
      neighborCount: 0,
      isRecommended: false,
      recommendationReason: 'Empty land',
      symbol: 'nftSTRK',
      neighborDetails: [] as Array<{
        location: number;
        priceESTRK: number;
        hourlyYield: number;
        timeRemaining: number;
        totalYieldFromThisNeighbor: number;
        symbol: string;
      }>
    };
  }

  return performanceCache.getPurchaseRecommendation(
    location,
    currentAuctionPrice,
    durationCapHours,
    () => {
      const { symbol, ratio } = getTokenInfoCached(currentLand.token_used, tokenCache);
  
  // Get current price (either auction price or sell price)
  const currentPrice = currentAuctionPrice || convertToESTRK(currentLand.sell_price, symbol, ratio);

  // Calculate maximum yield from neighbors (not constrained by our duration)
  const neighborYields = calculateNeighborYields(
    location, lands, tokenCache, neighborCache, activeAuctions, 
    false, // constrainToMyDuration = false - get full neighbor yields
    undefined,
    durationCapHours
  );
  
  if (neighborYields.totalYield <= 0) {
    return {
      currentPrice,
      maxYield: 0,
      recommendedPrice: currentPrice,
      requiredTaxPerHour: 0,
      requiredTotalTax: 0,
      requiredStakeForFullYield: 0,
      yieldDuration: 0,
      neighborCount: 0,
      isRecommended: false,
      recommendationReason: 'No profitable neighbors',
      symbol,
      neighborDetails: [] as Array<{
        location: number;
        priceESTRK: number;
        hourlyYield: number;
        timeRemaining: number;
        totalYieldFromThisNeighbor: number;
        symbol: string;
      }>
    };
  }

  // Calculate tax rate for this location (assume level zero for conservative estimate)
  const myTaxRate = getTaxRateCached('zero', location, neighborCache);
  const neighbors = neighborCache.get(location) || [];
  
  // Count neighbors that will receive tax from us
  let taxPayingNeighborCount = 0;
  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
      taxPayingNeighborCount++;
    }
  });
  
  let recommendedPrice = currentPrice;

  // Calculate required tax payments - accounting for when each neighbor gets nuked
  let requiredTaxPerHour = recommendedPrice * myTaxRate;
  let requiredTotalTax = 0;
  
  // Calculate tax paid to each neighbor until they get nuked
  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
      const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
      const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
      
      if (neighborTimeRemaining > 0) {
        // We pay tax to this neighbor until either they get nuked or we reach our duration cap
        const taxPaymentDuration = Math.min(durationCapHours, neighborTimeRemaining);
        requiredTotalTax += requiredTaxPerHour * taxPaymentDuration;
      }
    }
  });
  
  // Calculate required stake in nftSTRK (always display in nftSTRK for consistency)
  let requiredStakeForFullYield = requiredTotalTax;

  // Calculate net profit
  let grossProfit = neighborYields.totalYield;
  let netProfit = grossProfit - requiredTotalTax - currentPrice;

  // Determine recommendation
  let isRecommended = false;
  let recommendationReason = '';

  // if (location === 2335 ) {
  //   console.log({ location, neighborYields, currentPrice, recommendedPrice, requiredTaxPerHour, requiredTotalTax, requiredStakeForFullYield, yieldDuration: neighborYields.longestNeighborDuration, neighborCount: neighborYields.neighborDetails.length, isRecommended, recommendationReason, symbol, neighborDetails: neighborYields.neighborDetails, grossProfit, netProfit, taxPayingNeighborCount,yield_first_2h,remaining_yield, myTaxRate });
  // }
  if (neighborYields.yieldPerHour <= 0) {
    recommendationReason = 'No yield potential';
  } else if (netProfit <= currentPrice * 0.02) {
    recommendationReason = 'Low profitability';
  } else {
    isRecommended = true;
    recommendationReason = 'Profitable';
    // Calculate recommended price using conservative 2-hour strategy
    // yield_first_2h = guaranteed yield in first 2 hours
    // remaining_yield = risky longer-term yield
    let yield_first_1h = 0;
    neighborYields.neighborDetails.forEach(neighbor => {
      const safeYieldDuration = Math.min(1, neighbor.timeRemaining);
      yield_first_1h += neighbor.hourlyYield * safeYieldDuration;
    });
    recommendedPrice = currentPrice + (yield_first_1h * 0.8);

    // Calculate required tax payments - accounting for when each neighbor gets nuked
    requiredTaxPerHour = recommendedPrice * myTaxRate;
    let requiredTotalTax = 0;
    
    // Calculate tax paid to each neighbor until they get nuked
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        if (neighborTimeRemaining > 0) {
          // We pay tax to this neighbor until either they get nuked or we reach our duration cap
          const taxPaymentDuration = Math.min(durationCapHours, neighborTimeRemaining);
          requiredTotalTax += requiredTaxPerHour * taxPaymentDuration;
        }
      }
    });
    
    // Calculate required stake in nftSTRK (always display in nftSTRK for consistency)
    requiredStakeForFullYield = requiredTotalTax;
  
    // Calculate net profit
    grossProfit = neighborYields.totalYield;
    netProfit = grossProfit - requiredTotalTax - currentPrice;
  }

  return {
    currentPrice,
    maxYield: neighborYields.totalYield,
    recommendedPrice,
    requiredTaxPerHour,
    requiredTotalTax,
    requiredStakeForFullYield,
    yieldDuration: neighborYields.longestNeighborDuration,
    neighborCount: neighborYields.neighborDetails.length,
    isRecommended,
    recommendationReason,
    symbol,
    neighborDetails: neighborYields.neighborDetails.map((n: any) => {
      // Ensure all required properties exist
      const result = {
        location: n.location,
        priceESTRK: n.priceESTRK,
        hourlyYield: n.hourlyYield,
        timeRemaining: n.timeRemaining,
        totalYieldFromThisNeighbor: n.totalYieldFromThisNeighbor || 0,
        symbol: n.symbol
      };
      return result;
    }) as Array<{
      location: number;
      priceESTRK: number;
      hourlyYield: number;
      timeRemaining: number;
      totalYieldFromThisNeighbor: number;
      symbol: string;
    }>
      };
    }
  );
}; 
import { PonziLand, PonziLandAuction, PonziLandConfig, TokenPrice, TaxInfo, YieldInfo } from '../types/ponziland';
import { TAX_RATE_RAW, TIME_SPEED_FACTOR, MAX_NEIGHBOR_COUNT } from '../constants/ponziland';
import { getNeighborLocations } from './dataProcessing';
import { getTokenInfo, getTokenInfoCached, convertToSTRK, hexToDecimal, type TokenInfo } from './formatting';
import { getTokenMetadata } from '../data/tokenMetadata';
import { performanceCache } from './performanceCache';

const toNumber = (value: number | string | null | undefined, fallback: number): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveLevelDiscount = (level: string | undefined): number => {
  if (!level) return 0;
  const normalized = level.toString().toLowerCase();
  if (normalized === 'first' || normalized === '1') return 10;
  if (normalized === 'second' || normalized === '2') return 15;
  if (normalized === 'third' || normalized === '3') return 20;
  return 0;
};

const getBaseTaxRate = (config?: PonziLandConfig | null): number => {
  const taxRate = toNumber(config?.tax_rate, TAX_RATE_RAW);
  const timeSpeed = toNumber(config?.time_speed, TIME_SPEED_FACTOR);
  return (taxRate * timeSpeed) / (MAX_NEIGHBOR_COUNT * 100);
};

const getPerNeighborTaxRate = (level: string | undefined, config?: PonziLandConfig | null): number => {
  const baseRate = getBaseTaxRate(config);
  const discount = resolveLevelDiscount(level);
  return baseRate * ((100 - discount) / 100);
};


export const getTaxRate = (
  level: string | undefined,
  locationNum: number,
  config?: PonziLandConfig | null
): number => {
  const neighborCount = getNeighborLocations(locationNum).length;
  if (neighborCount === 0) {
    return 0;
  }
  return getPerNeighborTaxRate(level, config);
};

export const calculateTaxInfo = (
  location: number,
  lands: (PonziLand | null)[],
  prices: TokenPrice[],
  activeAuctions: Record<number, PonziLandAuction>,
  config?: PonziLandConfig | null
): TaxInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { taxPaid: 0, taxReceived: 0, profitPerHour: 0 };
  }

  const neighbors = getNeighborLocations(location);
  let taxPaid = 0;
  let taxReceived = 0;

  const { symbol: mySymbol, ratio: myRatio, decimals: myDecimals } = getTokenInfo(currentLand.token_used, prices);
  const myPriceESTRK = convertToSTRK(currentLand.sell_price, mySymbol, myRatio, myDecimals);

  if (currentLand.sell_price) {
    const myTaxRate = getTaxRate(currentLand.level, Number(currentLand.location), config);
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
      const { symbol: neighborSymbol, ratio: neighborRatio, decimals: neighborDecimals } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToSTRK(neighbor.sell_price, neighborSymbol, neighborRatio, neighborDecimals);
      const neighborTaxRate = getTaxRate(neighbor.level, Number(neighbor.location), config);
      taxReceived += neighborPriceESTRK * neighborTaxRate;
    }
  });

  return {
    taxPaid,
    taxReceived,
    profitPerHour: taxReceived - taxPaid
  };
};

export const calculateROI = (profitPerHour: number, landPriceSTRK: number): number => {
  if (landPriceSTRK <= 0) return 0;
  // ROI = (profit per hour / purchase price) × 100
  // Only the purchase price is considered as the investment
  return (profitPerHour / landPriceSTRK) * 100;
};

export const calculateBurnRate = (
  land: PonziLand | null,
  lands: (PonziLand | null)[],
  activeAuctions: Record<number, PonziLandAuction>,
  tokenCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  config?: PonziLandConfig | null
): number => {
  if (!land || !land.sell_price) return 0;

  const normalizedLocation = typeof land.location === 'string' ? Number(land.location) : land.location;
  const neighbors = neighborCache.get(normalizedLocation) || getNeighborLocations(normalizedLocation);

  const activeNeighbors = neighbors.filter(neighborLoc => {
    const neighbor = lands[neighborLoc];
    return neighbor && !activeAuctions[neighborLoc] && neighbor.owner;
  });

  if (activeNeighbors.length === 0) {
    return 0;
  }

  const { symbol, ratio, decimals } = getTokenInfoCached(land.token_used, tokenCache);
  const priceESTRK = convertToSTRK(land.sell_price, symbol, ratio, decimals);
  if (!priceESTRK || priceESTRK <= 0) {
    return 0;
  }

  const perNeighborRate = getPerNeighborTaxRate(land.level, config);
  if (perNeighborRate <= 0) {
    return 0;
  }

  return priceESTRK * perNeighborRate * activeNeighbors.length;
};

export const isNukable = (land: PonziLand | null, burnRate: number): 'nukable' | 'warning' | false => {
  if (!land) return false;
  const metadata = getTokenMetadata(land.token_used);
  const decimals = metadata?.decimals ?? 18;
  const stakedAmount = hexToDecimal(land.staked_amount || '0x0', decimals);
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
  activeAuctions: Record<number, PonziLandAuction>,
  config?: PonziLandConfig | null
): number => {
  const neighbors = getNeighborLocations(location);
  let potentialYield = 0;

  neighbors.forEach(neighborLoc => {
    const neighbor = lands[neighborLoc];
    if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
      const { symbol, ratio, decimals } = getTokenInfo(neighbor.token_used, prices);
      const neighborPriceESTRK = convertToSTRK(neighbor.sell_price, symbol, ratio, decimals);
      const neighborTaxRate = getTaxRate(neighbor.level, Number(neighbor.location), config);
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
    const metadata = getTokenMetadata(land.token_used);
    const decimals = metadata?.decimals ?? 18;
    const stakedAmount = hexToDecimal(land.staked_amount || '0x0', decimals);
    if (stakedAmount <= 0) return 0;
    return stakedAmount / burnRate;
  });
};

// Performance optimized versions using caches
export const getTaxRateCached = (
  level: string | undefined,
  locationNum: number,
  neighborCache: Map<number, number[]>,
  config?: PonziLandConfig | null
): number => {
  return performanceCache.getTaxRate(level || 'zero', locationNum, () => {
    const neighbors = neighborCache.get(locationNum) || [];
    if (neighbors.length === 0) {
      return 0;
    }
    return getPerNeighborTaxRate(level, config);
  });
};

export const calculateTaxInfoCached = (
  location: number,
  lands: (PonziLand | null)[],
  tokenCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  config?: PonziLandConfig | null
): TaxInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { taxPaid: 0, taxReceived: 0, profitPerHour: 0 };
  }

  const neighbors = neighborCache.get(location) || [];
  let taxPaid = 0;
  let taxReceived = 0;

  const { symbol: mySymbol, ratio: myRatio, decimals: myDecimals } = getTokenInfoCached(currentLand.token_used, tokenCache);
  const myPriceESTRK = convertToSTRK(currentLand.sell_price, mySymbol, myRatio, myDecimals);

  if (currentLand.sell_price) {
    const myTaxRate = getTaxRateCached(currentLand.level, Number(currentLand.location), neighborCache, config);
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
      const { symbol: neighborSymbol, ratio: neighborRatio, decimals: neighborDecimals } = getTokenInfoCached(neighbor.token_used, tokenCache);
      const neighborPriceESTRK = convertToSTRK(neighbor.sell_price, neighborSymbol, neighborRatio, neighborDecimals);
      const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache, config);
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
  tokenCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  durationCapHours: number = 24,
  config?: PonziLandConfig | null
): YieldInfo => {
  const currentLand = lands[location];
  if (!currentLand || activeAuctions[location]) {
    return { totalYield: 0, yieldPerHour: 0, taxPaidTotal: 0 };
  }

  const { symbol: mySymbol, ratio: myRatio, decimals: myDecimals } = getTokenInfoCached(currentLand.token_used, tokenCache);
  const myPriceESTRK = convertToSTRK(currentLand.sell_price, mySymbol, myRatio, myDecimals);
  const myBurnRate = calculateBurnRate(currentLand, lands, activeAuctions, tokenCache, neighborCache, config);
  const myTimeRemaining = calculateTimeRemainingHours(currentLand, myBurnRate);

  // Calculate yield received from neighbors (constrained by our duration)
  const neighborYields = calculateNeighborYields(
    location, lands, tokenCache, neighborCache, activeAuctions, 
    true, // constrainToMyDuration = true
    myTimeRemaining,
    durationCapHours,
    config
  );

  // Calculate tax paid to neighbors
  let totalTaxPaid = 0;
  let yieldPerHourPaid = 0;
  
  if (currentLand.sell_price) {
    const myTaxRate = getTaxRateCached(currentLand.level, Number(currentLand.location), neighborCache, config);
    const neighbors = neighborCache.get(location) || [];
    
    neighbors.forEach(neighborLoc => {
      const neighbor = lands[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions, tokenCache, neighborCache, config);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        if (neighborTimeRemaining > 0) {
          const hourlyTaxPaid = myPriceESTRK * myTaxRate;
          yieldPerHourPaid += hourlyTaxPaid;
          const taxPaymentDuration = Math.min(
            myTimeRemaining,
            neighborTimeRemaining,
            durationCapHours,
          );
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
  tokenCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  constrainToMyDuration: boolean = true,
  myTimeRemaining?: number,
  durationCapHours: number = 24,
  config?: PonziLandConfig | null
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
          const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions, tokenCache, neighborCache, config);
          const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
          
          if (neighborTimeRemaining > 0) {
            const { symbol: neighborSymbol, ratio: neighborRatio, decimals: neighborDecimals } = getTokenInfoCached(neighbor.token_used, tokenCache);
            const neighborPriceESTRK = convertToSTRK(neighbor.sell_price, neighborSymbol, neighborRatio, neighborDecimals);
            const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache, config);
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
  tokenCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, PonziLandAuction>,
  currentAuctionPrice?: number,
  durationCapHours: number = 24,
  config?: PonziLandConfig | null
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
      symbol: 'STRK',
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
      const { symbol, ratio, decimals } = getTokenInfoCached(currentLand.token_used, tokenCache);
  
  // Get current price (either auction price or sell price)
  const currentPrice = currentAuctionPrice || convertToSTRK(currentLand.sell_price, symbol, ratio, decimals);

  // Calculate maximum yield from neighbors (not constrained by our duration)
  const neighborYields = calculateNeighborYields(
    location,
    lands,
    tokenCache,
    neighborCache,
    activeAuctions,
    false, // constrainToMyDuration = false - get full neighbor yields
    undefined,
    durationCapHours,
    config
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
  const myTaxRate = getTaxRateCached('zero', location, neighborCache, config);
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
      const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions, tokenCache, neighborCache, config);
      const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
      
      if (neighborTimeRemaining > 0) {
        // We pay tax to this neighbor until either they get nuked or we reach our duration cap
        const taxPaymentDuration = Math.min(durationCapHours, neighborTimeRemaining);
        requiredTotalTax += requiredTaxPerHour * taxPaymentDuration;
      }
    }
  });
  
  // Calculate required stake in STRK (always display in STRK for consistency)
  let requiredStakeForFullYield = requiredTotalTax;

  // Calculate net profit
  let grossProfit = neighborYields.totalYield;
  let netProfit = grossProfit - requiredTotalTax - currentPrice;

  // Determine recommendation
  let isRecommended = false;
  let recommendationReason = '';

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
        const neighborBurnRate = calculateBurnRate(neighbor, lands, activeAuctions, tokenCache, neighborCache, config);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        if (neighborTimeRemaining > 0) {
          // We pay tax to this neighbor until either they get nuked or we reach our duration cap
          const taxPaymentDuration = Math.min(durationCapHours, neighborTimeRemaining);
          requiredTotalTax += requiredTaxPerHour * taxPaymentDuration;
        }
      }
    });
    
    // Calculate required stake in STRK (always display in STRK for consistency)
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

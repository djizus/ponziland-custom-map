import { PonziLand, PonziLandAuction } from '../types/ponziland';
import { GRID_SIZE } from '../constants/ponziland';
import { 
  getTaxRateCached, 
  calculateBurnRate, 
  calculateTimeRemainingHours,
  calculateTotalYieldInfoCached 
} from './taxCalculations';
import { getTokenInfoCached, convertToESTRK, hexToDecimal, displayCoordinates } from './formatting';
import { logError } from './errorHandler';

// Core calculation interfaces
export interface NeighborCalculationResult {
  location: number;
  neighbor: PonziLand;
  priceESTRK: number;
  taxRate: number;
  hourlyTax: number;
  burnRate: number;
  timeRemaining: number;
  symbol: string;
  ratio: number | null;
}

export interface YieldCalculationResult {
  yieldPerHour: number;
  totalYield: number;
  taxPaidTotal: number;
  longestNeighborDuration: number;
  neighborDetails: NeighborCalculationResult[];
}

export interface LandCalculationContext {
  location: number;
  land: PonziLand | null;
  gridData: { tiles: (PonziLand | null)[] };
  tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>;
  neighborCache: Map<number, number[]>;
  activeAuctions: Record<number, PonziLandAuction>;
}

/**
 * Core calculation engine that processes neighbors and calculates yield/tax information
 * This consolidates the duplicate logic found across TileComponent, Portfolio, and other calculations
 */
export class CalculationEngine {
  
  /**
   * Calculate detailed neighbor information for a given location
   * This replaces the repeated neighbor iteration logic
   */
  static calculateNeighborDetails(context: LandCalculationContext): NeighborCalculationResult[] {
    const { location, neighborCache, gridData, tokenInfoCache, activeAuctions } = context;
    const neighbors = neighborCache.get(location) || [];
    const results: NeighborCalculationResult[] = [];

    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
        const { symbol, ratio } = getTokenInfoCached(neighbor.token_used, tokenInfoCache);
        const priceESTRK = convertToESTRK(neighbor.sell_price, symbol, ratio);
        const taxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
        const burnRate = calculateBurnRate(neighbor, gridData.tiles, activeAuctions);
        const timeRemaining = calculateTimeRemainingHours(neighbor, burnRate);
        
        results.push({
          location: neighborLoc,
          neighbor,
          priceESTRK,
          taxRate,
          hourlyTax: priceESTRK * taxRate,
          burnRate,
          timeRemaining,
          symbol,
          ratio
        });
      }
    });

    return results;
  }

  /**
   * Calculate yield information for auction scenarios
   * Consolidates auction yield calculation logic
   */
  static calculateAuctionYield(
    context: LandCalculationContext,
    auctionPrice: number,
    myTimeRemaining: number = 48
  ): YieldCalculationResult {
    const { location, land, neighborCache } = context;
    
    if (!land) {
      return {
        yieldPerHour: 0,
        totalYield: 0,
        taxPaidTotal: 0,
        longestNeighborDuration: 0,
        neighborDetails: []
      };
    }

    const neighborDetails = this.calculateNeighborDetails(context);
    const myTaxRate = getTaxRateCached(land.level, location, neighborCache);
    
    // Calculate hourly rates
    let taxReceived = 0;
    let taxPaid = 0;
    let longestNeighborDuration = 0;

    neighborDetails.forEach(neighbor => {
      taxReceived += neighbor.hourlyTax;
      taxPaid += auctionPrice * myTaxRate;
      longestNeighborDuration = Math.max(longestNeighborDuration, neighbor.timeRemaining);
    });

    const yieldPerHour = taxReceived - taxPaid;
    const effectiveTimeRemaining = Math.max(longestNeighborDuration, myTimeRemaining);
    
    // Calculate time-based total yield
    let totalYieldReceived = 0;
    let totalTaxPaid = 0;

    neighborDetails.forEach(neighbor => {
      if (neighbor.timeRemaining > 0) {
        const taxReceivingDuration = Math.min(effectiveTimeRemaining, neighbor.timeRemaining);
        totalYieldReceived += neighbor.hourlyTax * taxReceivingDuration;
        
        const hourlyTaxPaid = auctionPrice * myTaxRate;
        const taxPaymentDuration = Math.min(effectiveTimeRemaining, neighbor.timeRemaining);
        totalTaxPaid += hourlyTaxPaid * taxPaymentDuration;
      }
    });

    const totalYield = totalYieldReceived - totalTaxPaid - auctionPrice;

    return {
      yieldPerHour,
      totalYield,
      taxPaidTotal: totalTaxPaid,
      longestNeighborDuration,
      neighborDetails
    };
  }

  /**
   * Calculate standard land yield (non-auction)
   * Consolidates regular yield calculation logic
   */
  static calculateLandYield(context: LandCalculationContext): YieldCalculationResult {
    const { location, land, gridData, tokenInfoCache, neighborCache, activeAuctions } = context;
    
    if (!land) {
      return {
        yieldPerHour: 0,
        totalYield: 0,
        taxPaidTotal: 0,
        longestNeighborDuration: 0,
        neighborDetails: []
      };
    }

    // Use existing cached calculation for regular lands
    const yieldInfo = calculateTotalYieldInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions);
    const neighborDetails = this.calculateNeighborDetails(context);
    
    return {
      yieldPerHour: yieldInfo.yieldPerHour,
      totalYield: yieldInfo.totalYield,
      taxPaidTotal: yieldInfo.taxPaidTotal,
      longestNeighborDuration: Math.max(...neighborDetails.map(n => n.timeRemaining), 0),
      neighborDetails
    };
  }

  /**
   * Calculate portfolio metrics for multiple lands
   * Consolidates portfolio aggregation logic
   */
  static calculatePortfolioMetrics(
    lands: PonziLand[],
    gridData: { tiles: (PonziLand | null)[] },
    tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>,
    neighborCache: Map<number, number[]>,
    activeAuctions: Record<number, PonziLandAuction>
  ) {
    let totalYieldPerHour = 0;
    let totalTaxesPerHour = 0;
    let totalStaked = 0;
    let totalBurnRate = 0;
    let totalLandValue = 0;
    let nukableCount = 0;
    let warningCount = 0;
    const landsByLevel: Record<string, number> = {};
    const criticalLands: Array<{
      location: number;
      coordinates: string;
      timeRemaining: number;
      landValue: number;
      symbol: string;
    }> = [];

    let totalRealEarnings = 0;

    lands.forEach((land) => {
      try {
        const location = parseInt(land.location);
        const token = tokenInfoCache.get(land.token_used);
        const ratio = token?.ratio || null;
        
        if (!token) return;

        const effectiveRatio = ratio || 1;
        const context: LandCalculationContext = {
          location,
          land,
          gridData,
          tokenInfoCache,
          neighborCache,
          activeAuctions
        };

        const yieldInfo = this.calculateLandYield(context);
        const burnRate = calculateBurnRate(land, gridData.tiles, activeAuctions);
        const landPriceESTRK = convertToESTRK(land.sell_price, token.symbol, effectiveRatio);
        
        totalYieldPerHour += yieldInfo.yieldPerHour || 0;
        
        // Calculate taxes using consolidated logic
        const myTaxRate = getTaxRateCached(land.level || 'zero', location, neighborCache);
        const hourlyTax = landPriceESTRK * myTaxRate;
        totalTaxesPerHour += hourlyTax || 0;
        
        totalStaked += hexToDecimal(land.staked_amount || '0x0');
        totalBurnRate += burnRate;
        totalLandValue += landPriceESTRK;

        // Time-based calculations
        const timeRemaining = burnRate > 0 ? hexToDecimal(land.staked_amount || '0x0') / burnRate : Infinity;
        if (timeRemaining <= 2) {
          nukableCount++;
          const row = Math.floor(location / GRID_SIZE);
          const col = location % GRID_SIZE;
          criticalLands.push({
            location,
            coordinates: displayCoordinates(col, row),
            timeRemaining,
            landValue: landPriceESTRK,
            symbol: token.symbol
          });
        } else if (timeRemaining <= 4) {
          warningCount++;
        }

        // Level counting
        const level = land.level || 'zero';
        landsByLevel[level] = (landsByLevel[level] || 0) + 1;
        
        // Real earnings calculation
        const netHourlyYield = yieldInfo.yieldPerHour - hourlyTax;
        const actualTimeRemaining = timeRemaining === Infinity ? 8760 : timeRemaining;
        totalRealEarnings += netHourlyYield * actualTimeRemaining;
        
      } catch (error) {
        logError('PORTFOLIO_CALCULATION', error, {
          component: 'CalculationEngine',
          operation: 'calculatePortfolioMetrics',
          metadata: { 
            landLocation: land.location,
            landLevel: land.level,
            skipReason: 'calculation_error'
          }
        });
        // Skip lands with calculation errors
      }
    });

    const netYieldPerHour = totalYieldPerHour - totalTaxesPerHour;
    const totalLands = lands.length;
    const avgLandValue = totalLands > 0 ? totalLandValue / totalLands : 0;
    const avgYieldPerLand = totalLands > 0 ? totalYieldPerHour / totalLands : 0;

    return {
      totalLands,
      totalYieldPerHour,
      totalTaxesPerHour,
      netYieldPerHour,
      totalStaked,
      totalBurnRate,
      totalLandValue,
      avgLandValue,
      avgYieldPerLand,
      nukableCount,
      warningCount,
      landsByLevel,
      totalRealEarnings,
      criticalLands
    };
  }

  /**
   * Calculate potential yield for a location (used in recommendations)
   * Consolidates potential yield calculation logic
   */
  static calculatePotentialYield(context: LandCalculationContext): number {
    const neighborDetails = this.calculateNeighborDetails(context);
    return neighborDetails.reduce((total, neighbor) => total + neighbor.hourlyTax, 0);
  }

  /**
   * Calculate tax information for a land - optimized version
   * Consolidates tax calculation logic that was repeated in multiple functions
   */
  static calculateOptimizedTaxInfo(
    context: LandCalculationContext,
    currentPrice?: number
  ): {
    taxPaid: number;
    taxReceived: number;
    profitPerHour: number;
    taxPaidPerHour: number;
    taxReceivedPerHour: number;
  } {
    const { location, land, neighborCache } = context;
    
    if (!land || context.activeAuctions[location]) {
      return { 
        taxPaid: 0, 
        taxReceived: 0, 
        profitPerHour: 0, 
        taxPaidPerHour: 0, 
        taxReceivedPerHour: 0 
      };
    }

    const neighborDetails = this.calculateNeighborDetails(context);
    const price = currentPrice || (land.sell_price ? convertToESTRK(land.sell_price, 'nftSTRK', 1) : 0);
    
    // Calculate tax received (from neighbors)
    const taxReceivedPerHour = neighborDetails.reduce((total, neighbor) => total + neighbor.hourlyTax, 0);
    
    // Calculate tax paid (to neighbors)
    const myTaxRate = getTaxRateCached(land.level, location, neighborCache);
    const taxPaidPerHour = neighborDetails.length * price * myTaxRate;
    
    const profitPerHour = taxReceivedPerHour - taxPaidPerHour;

    // For time-based totals, we'd need duration logic, but for now return hourly rates
    return {
      taxPaid: taxPaidPerHour, // This would need time calculation for total
      taxReceived: taxReceivedPerHour, // This would need time calculation for total  
      profitPerHour,
      taxPaidPerHour,
      taxReceivedPerHour
    };
  }

  /**
   * Batch calculate metrics for multiple locations
   * Useful for optimizing bulk calculations
   */
  static batchCalculateMetrics(
    locations: number[],
    gridData: { tiles: (PonziLand | null)[] },
    tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>,
    neighborCache: Map<number, number[]>,
    activeAuctions: Record<number, PonziLandAuction>
  ): Map<number, YieldCalculationResult> {
    const results = new Map<number, YieldCalculationResult>();
    
    locations.forEach(location => {
      const land = gridData.tiles[location];
      if (land) {
        const context: LandCalculationContext = {
          location,
          land,
          gridData,
          tokenInfoCache,
          neighborCache,
          activeAuctions
        };
        
        results.set(location, this.calculateLandYield(context));
      }
    });
    
    return results;
  }
}

// Export helper functions for backward compatibility
export const calculateNeighborDetails = CalculationEngine.calculateNeighborDetails;
export const calculateAuctionYield = CalculationEngine.calculateAuctionYield;
export const calculateLandYield = CalculationEngine.calculateLandYield;
export const calculatePortfolioMetrics = CalculationEngine.calculatePortfolioMetrics;
export const calculatePotentialYield = CalculationEngine.calculatePotentialYield;
export const calculateOptimizedTaxInfo = CalculationEngine.calculateOptimizedTaxInfo;
export const batchCalculateMetrics = CalculationEngine.batchCalculateMetrics;
import { useMemo } from 'react';
import { PonziLand, PonziLandAuction, TokenPrice } from '../types/ponziland';
import { hexToDecimal, calculateESTRKPrice, getTokenInfoCached } from '../utils/formatting';
import { CalculationEngine, LandCalculationContext } from '../utils/calculationEngine';
import { calculateBurnRate, calculateTimeRemainingHours } from '../utils/taxCalculations';

export interface PlayerStats {
  totalLandsOwned: number;
  totalPortfolioValue: number;
  totalStakedValue: number;
  totalYield: number;
  bestPerformingLand: { location: number; grossReturn: number; coords: string; display: string } | null;
  worstPerformingLand: { location: number; grossReturn: number; coords: string; display: string } | null;
  nukableRiskLands: Array<{ location: number; timeRemaining: number; coords: string; display: string }>;
}

export const usePlayerStats = (
  selectedPlayerAddresses: Set<string>,
  gridData: { tiles: (PonziLand | null)[]; activeRows: number[]; activeCols: number[] },
  activeAuctions: Record<number, PonziLandAuction>,
  tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>,
  neighborCache: Map<number, number[]>,
  activeTileLocations: Array<{ row: number; col: number; location: number }>,
  prices: TokenPrice[],
  durationCapHours: number
): PlayerStats => {
  return useMemo(() => {
    // If no players selected, return empty stats
    if (selectedPlayerAddresses.size === 0) {
      return {
        totalLandsOwned: 0,
        totalPortfolioValue: 0,
        totalStakedValue: 0,
        totalYield: 0,
        bestPerformingLand: null,
        worstPerformingLand: null,
        nukableRiskLands: []
      };
    }

    let totalLandsOwned = 0;
    let totalPortfolioValue = 0;
    let totalStakedValue = 0;
    let totalYield = 0;
    let bestLand: { location: number; grossReturn: number; coords: string; display: string } | null = null;
    let worstLand: { location: number; grossReturn: number; coords: string; display: string } | null = null;
    const nukableRiskLands: Array<{ location: number; timeRemaining: number; coords: string; display: string }> = [];

    // Helper function to convert grid position to coordinates  
    const getCoordinates = (row: number, col: number): string => {
      return `${col}, ${row}`;
    };

    // Helper function to format location display
    const formatLocationDisplay = (location: number, coords: string, grossReturn: number): string => {
      const sign = grossReturn >= 0 ? '+' : '';
      return `${sign}${grossReturn.toFixed(1)} | Land ${location} (${coords})`;
    };


    // Process each tile
    activeTileLocations.forEach(({ row, col, location }) => {
      const land = gridData.tiles[location];
      
      // Skip if no land or not owned by selected player
      if (!land || !selectedPlayerAddresses.has(land.owner.toLowerCase())) {
        return;
      }

      totalLandsOwned++;

      // Calculate portfolio value (current ask price)
      if (land.sell_price && land.sell_price !== '0x0') {
        const tokenInfo = getTokenInfoCached(land.token_used, tokenInfoCache);
        const landPriceESTRK = calculateESTRKPrice(land.sell_price, tokenInfo.ratio);
        totalPortfolioValue += Number(landPriceESTRK);
      }

      // Calculate staked value
      if (land.staked_amount) {
        const stakedAmount = hexToDecimal(land.staked_amount);
        totalStakedValue += Number(stakedAmount);
      }

      // Calculate gross return using existing calculation engine
      const context: LandCalculationContext = {
        location,
        land,
        gridData,
        tokenInfoCache,
        neighborCache,
        activeAuctions
      };

      const yieldResult = CalculationEngine.calculateLandYield(context);
      const tokenInfo = getTokenInfoCached(land.token_used, tokenInfoCache);
      const landPriceESTRK = land.sell_price ? calculateESTRKPrice(land.sell_price, tokenInfo.ratio) : 0;
      const grossReturn = Number(yieldResult.totalYield) + Number(landPriceESTRK);
      
      totalYield += grossReturn;

      // Track best and worst performing lands
      const coords = getCoordinates(row, col);
      const display = formatLocationDisplay(location, coords, grossReturn);
      if (!bestLand || grossReturn > bestLand.grossReturn) {
        bestLand = { location, grossReturn, coords, display };
      }
      if (!worstLand || grossReturn < worstLand.grossReturn) {
        worstLand = { location, grossReturn, coords, display };
      }

      // Check for nukable risk (< 2h remaining)
      if (land.staked_amount) {
        const stakedAmount = hexToDecimal(land.staked_amount);
        if (stakedAmount > 0) {
          // Use existing burn rate calculation
          const burnRate = calculateBurnRate(land, gridData.tiles, activeAuctions);
          
          if (burnRate > 0) {
            const timeRemaining = calculateTimeRemainingHours(land, burnRate);
            
            if (timeRemaining < 2) { // Less than 2 hours
              const riskDisplay = `Land ${location} (${coords})`;
              nukableRiskLands.push({ location, timeRemaining, coords, display: riskDisplay });
            }
          }
        }
      }
    });

    return {
      totalLandsOwned,
      totalPortfolioValue,
      totalStakedValue,
      totalYield,
      bestPerformingLand: bestLand,
      worstPerformingLand: worstLand,
      nukableRiskLands: nukableRiskLands.sort((a, b) => a.timeRemaining - b.timeRemaining)
    };
  }, [selectedPlayerAddresses, gridData, activeAuctions, tokenInfoCache, neighborCache, activeTileLocations, prices, durationCapHours]);
};
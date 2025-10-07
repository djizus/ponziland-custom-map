import { useMemo } from 'react';
import { PonziLand, PonziLandAuction, PonziLandConfig, TokenPrice } from '../types/ponziland';
import { convertToSTRK, getTokenInfoCached, type TokenInfo } from '../utils/formatting';
import {
  calculateBurnRate,
  calculateNeighborYields,
  calculateTimeRemainingHours,
  getTaxRateCached,
} from '../utils/taxCalculations';

export interface TokenPnlSummary {
  symbol: string;
  ratio: number | null;
  tokenDecimals: number;
  hourlyIncome: number;
  hourlyCost: number;
  totalIncome: number;
  totalCost: number;
}

export interface PnlTimelinePoint {
  hour: number;
  netStrk: number;
  cumulativeStrk: number;
  perToken: Record<string, number>;
}

export interface PlayerStats {
  totalLandsOwned: number;
  totalPortfolioValue: number;
  totalStakedValue: number;
  totalYield: number;
  totalYieldPerHour: number;
  totalYieldPerHourUSD: number | null;
  totalIncomeStrk: number;
  totalCostStrk: number;
  estimatedNetStrk: number;
  tokenBreakdown: TokenPnlSummary[];
  pnlTimeline: PnlTimelinePoint[];
  bestPerformingLand: { location: number; grossReturn: number; coords: string; display: string } | null;
  worstPerformingLand: { location: number; grossReturn: number; coords: string; display: string } | null;
  nukableRiskLands: Array<{ location: number; timeRemaining: number; coords: string; display: string }>;
}

export const usePlayerStats = (
  selectedPlayerAddresses: Set<string>,
  gridData: { tiles: (PonziLand | null)[]; activeRows: number[]; activeCols: number[] },
  activeAuctions: Record<number, PonziLandAuction>,
  tokenInfoCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeTileLocations: Array<{ row: number; col: number; location: number }>,
  prices: TokenPrice[],
  durationCapHours: number,
  config: PonziLandConfig | null
): PlayerStats => {
  return useMemo(() => {
    const usdStableSymbols = ['USDC', 'USDT', 'DAI'];
    const strkUsdRate = (() => {
      for (const stable of usdStableSymbols) {
        const token = prices.find(p => (p.symbol || '').toUpperCase() === stable);
        if (token?.ratio && token.ratio > 0) {
          return token.ratio;
        }
      }
      return null;
    })();

    // If no players selected, return empty stats
    if (selectedPlayerAddresses.size === 0) {
      return {
        totalLandsOwned: 0,
        totalPortfolioValue: 0,
        totalStakedValue: 0,
        totalYield: 0,
        totalYieldPerHour: 0,
        totalYieldPerHourUSD: strkUsdRate ? 0 : null,
        totalIncomeStrk: 0,
        totalCostStrk: 0,
        estimatedNetStrk: 0,
        tokenBreakdown: [],
        pnlTimeline: [],
        bestPerformingLand: null,
        worstPerformingLand: null,
        nukableRiskLands: []
      };
    }

    let totalLandsOwned = 0;
    let totalPortfolioValue = 0;
    let totalStakedValue = 0;
    let totalYield = 0;
    let totalYieldPerHour = 0;
    const safeDurationCap = Math.min(48, Math.max(1, Math.round(durationCapHours || 24)));
    const timelineBuckets = Array.from({ length: safeDurationCap }, () => ({
      netStrk: 0,
      perToken: new Map<string, number>(),
    }));

    const tokenAggregation = new Map<string, TokenPnlSummary>();

    const getTokenSummary = (symbol: string, ratio: number | null, tokenDecimals: number): TokenPnlSummary => {
      const key = symbol.toUpperCase();
      let summary = tokenAggregation.get(key);
      if (!summary) {
        summary = {
          symbol: key,
          ratio,
          tokenDecimals,
          hourlyIncome: 0,
          hourlyCost: 0,
          totalIncome: 0,
          totalCost: 0,
        };
        tokenAggregation.set(key, summary);
      } else {
        // Preserve ratio/decimals if previous entry lacked it and new data provides it
        if ((summary.ratio === null || summary.ratio === undefined) && ratio !== null && ratio !== undefined) {
          summary.ratio = ratio;
        }
        if (!summary.tokenDecimals && tokenDecimals) {
          summary.tokenDecimals = tokenDecimals;
        }
      }
      return summary;
    };

    let bestLand: { location: number; grossReturn: number; coords: string; display: string } | null = null;
    let worstLand: { location: number; grossReturn: number; coords: string; display: string } | null = null;
    const nukableRiskLands: Array<{ location: number; timeRemaining: number; coords: string; display: string }> = [];
    let totalIncomeStrk = 0;
    let totalCostStrk = 0;

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
      const tokenInfo = getTokenInfoCached(land.token_used, tokenInfoCache);
      const tokenSymbol = (tokenInfo.symbol || 'STRK').toUpperCase();
      const tokenRatio = tokenSymbol === 'STRK' ? 1 : tokenInfo.ratio ?? null;

      if (land.sell_price && land.sell_price !== '0x0') {
        const landPriceSTRK = convertToSTRK(
          land.sell_price,
          tokenInfo.symbol,
          tokenInfo.ratio,
          tokenInfo.decimals,
        );
        totalPortfolioValue += landPriceSTRK;
      }

      const landPriceSTRK = land.sell_price
        ? convertToSTRK(land.sell_price, tokenInfo.symbol, tokenInfo.ratio, tokenInfo.decimals)
        : 0;
      const stakedValueSTRK = convertToSTRK(
        land.staked_amount || '0x0',
        tokenInfo.symbol,
        tokenInfo.ratio,
        tokenInfo.decimals,
      );
      totalStakedValue += stakedValueSTRK;

      // Detailed income & cost breakdown using duration cap horizon
      const myBurnRate = calculateBurnRate(
        land,
        gridData.tiles,
        activeAuctions,
        tokenInfoCache,
        neighborCache,
        config,
      );
      const myTimeRemaining = calculateTimeRemainingHours(land, myBurnRate);
      const neighborYieldDetails = calculateNeighborYields(
        location,
        gridData.tiles,
        tokenInfoCache,
        neighborCache,
        activeAuctions,
        true,
        myTimeRemaining,
        safeDurationCap,
        config,
      );

      const myTaxRate = getTaxRateCached(land.level, Number(land.location), neighborCache, config);
      const neighbors = neighborCache.get(location) || [];

      let hourlyTaxPaid = 0;
      let totalTaxPaid = 0;

      // Incoming yields per neighbor
      neighborYieldDetails.neighborDetails.forEach(neighbor => {
        const hourlyYieldStrk = Number.isFinite(neighbor.hourlyYield) ? neighbor.hourlyYield : 0;
        if (hourlyYieldStrk === 0) {
          return;
        }

        const duration = Math.max(
          0,
          Math.min(
            safeDurationCap,
            neighbor.timeRemaining ?? safeDurationCap,
            Number.isFinite(myTimeRemaining) ? myTimeRemaining : safeDurationCap,
          ),
        );

        const totalYieldForNeighbor = Number.isFinite(neighbor.totalYieldFromThisNeighbor)
          ? neighbor.totalYieldFromThisNeighbor
          : hourlyYieldStrk * duration;

        const incomeSummary = getTokenSummary(
          neighbor.symbol || 'STRK',
          neighbor.symbol?.toUpperCase() === 'STRK' ? 1 : neighbor.ratio ?? null,
          neighbor.decimals ?? 6,
        );

        incomeSummary.hourlyIncome += hourlyYieldStrk;
        incomeSummary.totalIncome += totalYieldForNeighbor;

        totalIncomeStrk += totalYieldForNeighbor;

        for (let hourIndex = 0; hourIndex < safeDurationCap; hourIndex++) {
          const span = Math.min(1, Math.max(0, duration - hourIndex));
          if (span <= 0) break;

          const bucket = timelineBuckets[hourIndex];
          const delta = hourlyYieldStrk * span;
          bucket.netStrk += delta;

          const current = bucket.perToken.get(incomeSummary.symbol) ?? 0;
          bucket.perToken.set(incomeSummary.symbol, current + delta);
        }
      });

      // Outgoing taxes per neighbor
      neighbors.forEach(neighborLoc => {
        const neighborTile = gridData.tiles[neighborLoc];
        if (!neighborTile || !neighborTile.owner || activeAuctions[neighborLoc]) {
          return;
        }

        const neighborBurnRate = calculateBurnRate(
          neighborTile,
          gridData.tiles,
          activeAuctions,
          tokenInfoCache,
          neighborCache,
          config,
        );
        const neighborTimeRemaining = calculateTimeRemainingHours(neighborTile, neighborBurnRate);

        if (neighborTimeRemaining <= 0) {
          return;
        }

        const hourlyTaxForNeighbor = landPriceSTRK * myTaxRate;
        if (hourlyTaxForNeighbor <= 0) {
          return;
        }

        const taxDuration = Math.max(
          0,
          Math.min(
            safeDurationCap,
            neighborTimeRemaining,
            Number.isFinite(myTimeRemaining) ? myTimeRemaining : safeDurationCap,
          ),
        );

        const taxSummary = getTokenSummary(tokenSymbol, tokenRatio, tokenInfo.decimals ?? 18);
        taxSummary.hourlyCost += hourlyTaxForNeighbor;
        taxSummary.totalCost += hourlyTaxForNeighbor * taxDuration;

        totalCostStrk += hourlyTaxForNeighbor * taxDuration;

        for (let hourIndex = 0; hourIndex < safeDurationCap; hourIndex++) {
          const span = Math.min(1, Math.max(0, taxDuration - hourIndex));
          if (span <= 0) break;

          const bucket = timelineBuckets[hourIndex];
          const delta = hourlyTaxForNeighbor * span;
          bucket.netStrk -= delta;

          const current = bucket.perToken.get(taxSummary.symbol) ?? 0;
          bucket.perToken.set(taxSummary.symbol, current - delta);
        }

        hourlyTaxPaid += hourlyTaxForNeighbor;
        totalTaxPaid += hourlyTaxForNeighbor * taxDuration;
      });

      const grossReturn = neighborYieldDetails.totalYield - totalTaxPaid;
      totalYield += grossReturn;
      totalYieldPerHour += neighborYieldDetails.yieldPerHour - hourlyTaxPaid;

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
      if (stakedValueSTRK > 0) {
        const burnRate = calculateBurnRate(
          land,
          gridData.tiles,
          activeAuctions,
          tokenInfoCache,
          neighborCache,
          config,
        );

        if (burnRate > 0) {
          const timeRemaining = stakedValueSTRK / burnRate;
          if (timeRemaining < 2) { // Less than 2 hours
            const riskDisplay = `Land ${location} (${coords})`;
            nukableRiskLands.push({ location, timeRemaining, coords, display: riskDisplay });
          }
        }
      }
    });

    const estimatedNetStrk = totalIncomeStrk - totalCostStrk;

    let cumulative = 0;
    const pnlTimeline: PnlTimelinePoint[] = timelineBuckets.map((bucket, index) => {
      cumulative += bucket.netStrk;
      return {
        hour: index + 1,
        netStrk: bucket.netStrk,
        cumulativeStrk: cumulative,
        perToken: Object.fromEntries(bucket.perToken),
      };
    });

    return {
      totalLandsOwned,
      totalPortfolioValue,
      totalStakedValue,
      totalYield,
      totalYieldPerHour,
      totalYieldPerHourUSD: strkUsdRate ? totalYieldPerHour * strkUsdRate : null,
      totalIncomeStrk,
      totalCostStrk,
      estimatedNetStrk,
      tokenBreakdown: Array.from(tokenAggregation.values()).sort((a, b) => (b.totalIncome - b.totalCost) - (a.totalIncome - a.totalCost)),
      pnlTimeline,
      bestPerformingLand: bestLand,
      worstPerformingLand: worstLand,
      nukableRiskLands: nukableRiskLands.sort((a, b) => a.timeRemaining - b.timeRemaining)
    };
  }, [selectedPlayerAddresses, gridData, activeAuctions, tokenInfoCache, neighborCache, activeTileLocations, config, prices, durationCapHours]);
};

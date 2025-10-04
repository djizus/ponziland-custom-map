import { useState, useEffect, useMemo } from 'react';
import { PonziLand, PonziLandAuction, PonziLandStake, PonziLandConfig, TokenPrice } from '../types/ponziland';
import { GRID_SIZE } from '../constants/ponziland';
import {
  processGridData,
  getNeighborLocations,
  getCoordinates,
  normalizeLocation,
} from '../utils/dataProcessing';
import { performanceCache } from '../utils/performanceCache';
import { compareLandArrays } from '../utils/smartDiff';
import { BASE_TOKEN_SYMBOL, normalizeTokenAddress, type TokenInfo } from '../utils/formatting';
import { getTokenMetadata, listTokenMetadata } from '../data/tokenMetadata';

export const useGameData = (
  landsSqlData: PonziLand[],
  auctionsSqlData: PonziLandAuction[],
  stakesSqlData: PonziLandStake[],
  prices: TokenPrice[],
  loadingSql: boolean,
  configSqlData: PonziLandConfig | null
) => {
  const [gridData, setGridData] = useState<{
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
    activeLocations: number[];
  }>({ tiles: [], activeRows: [], activeCols: [], activeLocations: [] });
  
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});

  // Performance optimization: Create token info cache to avoid repeated lookups
  const tokenInfoCache = useMemo(() => {
    const cache = new Map<string, TokenInfo>();
    prices.forEach(token => {
      if (!token?.address) {
        return;
      }

      const normalizedAddress = normalizeTokenAddress(token.address);
      const metadata = getTokenMetadata(token.address);
      const value: TokenInfo = {
        symbol: token.symbol,
        ratio: token.ratio ?? null,
        decimals: metadata?.decimals ?? 18,
      };

      cache.set(normalizedAddress, value);

      const lowerAddress = token.address.toLowerCase();
      if (lowerAddress !== normalizedAddress) {
        cache.set(lowerAddress, value);
      }
    });

    // Ensure metadata-only tokens exist even if price feed missing
    listTokenMetadata().forEach(meta => {
      const normalizedAddress = normalizeTokenAddress(meta.address);
      if (!cache.has(normalizedAddress)) {
        const info: TokenInfo = {
          symbol: meta.symbol,
          ratio: null,
          decimals: meta.decimals,
        };
        cache.set(normalizedAddress, info);
        cache.set(meta.address.toLowerCase(), info);
      }
    });

    // Add default entries for base STRK token
    cache.set('', { symbol: BASE_TOKEN_SYMBOL, ratio: 1, decimals: 18 });
    cache.set('0x0', { symbol: BASE_TOKEN_SYMBOL, ratio: 1, decimals: 18 });
    cache.set('0', { symbol: BASE_TOKEN_SYMBOL, ratio: 1, decimals: 18 });
    return cache;
  }, [prices]);

  // Performance optimization: Create neighbor location cache
  const neighborCache = useMemo(() => {
    const cache = new Map<number, number[]>();
    gridData.activeLocations.forEach(location => {
      cache.set(location, getNeighborLocations(location));
    });
    Object.keys(activeAuctions).forEach(key => {
      const location = Number(key);
      if (!cache.has(location)) {
        cache.set(location, getNeighborLocations(location));
      }
    });
    return cache;
  }, [gridData.activeLocations, activeAuctions]);

  // Performance optimization: Pre-calculate all tile locations to avoid nested maps
  const activeTileLocations = useMemo(() => {
    const uniqueLocations = new Set<number>(gridData.activeLocations);
    Object.keys(activeAuctions).forEach(key => {
      const normalized = normalizeLocation(Number(key));
      if (normalized !== null) {
        uniqueLocations.add(normalized);
      }
    });

    const entries: Array<{ row: number; col: number; location: number }> = [];
    uniqueLocations.forEach(location => {
      const [col, row] = getCoordinates(location);
      entries.push({ row, col, location });
    });

    return entries.sort((a, b) => {
      if (a.row === b.row) return a.col - b.col;
      return a.row - b.row;
    });
  }, [gridData.activeLocations, activeAuctions]);

  // Process grid data when SQL data changes
  useEffect(() => {
    if (landsSqlData && stakesSqlData && landsSqlData.length > 0) {
      const newGridData = processGridData(landsSqlData, stakesSqlData);
      // Only update if grid data has actually changed
      setGridData(prevGridData => {
        if (!compareLandArrays(prevGridData.tiles, newGridData.tiles)) {
          performanceCache.updateLandsVersion();
          performanceCache.updateStakesVersion();
          return newGridData;
        }
        return prevGridData;
      });
    } else if (!loadingSql && landsSqlData && landsSqlData.length === 0) {
      setGridData({
        tiles: Array(GRID_SIZE * GRID_SIZE).fill(null),
        activeRows: [],
        activeCols: [],
        activeLocations: [],
      });
    }
  }, [landsSqlData, stakesSqlData, loadingSql]);

  // Process auctions
  useEffect(() => {
    if (auctionsSqlData) {
      const filteredAuctions = auctionsSqlData
        .filter((auction: PonziLandAuction) => !auction.is_finished)
        .reduce((acc: Record<number, PonziLandAuction>, auction: PonziLandAuction) => {
          const normalizedAuction =
            configSqlData?.decay_rate !== undefined &&
            configSqlData.decay_rate !== null &&
            (auction.decay_rate === undefined || auction.decay_rate === null)
              ? { ...auction, decay_rate: String(configSqlData.decay_rate) }
              : auction;
          const normalizedLocation = normalizeLocation(auction.land_location);
          if (normalizedLocation !== null) {
            acc[normalizedLocation] = normalizedAuction;
          }
          return acc;
        }, {});
      setActiveAuctions(filteredAuctions);
      performanceCache.updateAuctionsVersion();
    }
  }, [auctionsSqlData, configSqlData?.decay_rate]);

  return {
    gridData,
    activeAuctions,
    tokenInfoCache,
    neighborCache,
    activeTileLocations
  };
};

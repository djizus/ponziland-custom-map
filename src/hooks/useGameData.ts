import { useState, useEffect, useMemo } from 'react';
import { PonziLand, PonziLandAuction, PonziLandStake, TokenPrice } from '../types/ponziland';
import { GRID_SIZE } from '../constants/ponziland';
import { processGridData, getNeighborLocations } from '../utils/dataProcessing';
import { performanceCache } from '../utils/performanceCache';
import { compareLandArrays } from '../utils/smartDiff';

export const useGameData = (
  landsSqlData: PonziLand[],
  auctionsSqlData: PonziLandAuction[],
  stakesSqlData: PonziLandStake[],
  prices: TokenPrice[],
  loadingSql: boolean
) => {
  const [gridData, setGridData] = useState<{
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
  }>({ tiles: [], activeRows: [], activeCols: [] });
  
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});

  // Performance optimization: Create token info cache to avoid repeated lookups
  const tokenInfoCache = useMemo(() => {
    const cache = new Map<string, { symbol: string; ratio: number | null }>();
    prices.forEach(token => {
      cache.set(token.address.toLowerCase(), { symbol: token.symbol, ratio: token.ratio });
    });
    // Add default entry for empty token_used
    cache.set('', { symbol: 'nftSTRK', ratio: null });
    return cache;
  }, [prices]);

  // Performance optimization: Create neighbor location cache
  const neighborCache = useMemo(() => {
    const cache = new Map<number, number[]>();
    if (gridData.activeRows.length > 0 && gridData.activeCols.length > 0) {
      gridData.activeRows.forEach(row => {
        gridData.activeCols.forEach(col => {
          const location = row * GRID_SIZE + col;
          cache.set(location, getNeighborLocations(location));
        });
      });
    }
    return cache;
  }, [gridData.activeRows, gridData.activeCols]);

  // Performance optimization: Pre-calculate all tile locations to avoid nested maps
  const activeTileLocations = useMemo(() => {
    const locations: Array<{ row: number; col: number; location: number }> = [];
    gridData.activeRows.forEach(row => {
      gridData.activeCols.forEach(col => {
        locations.push({ row, col, location: row * GRID_SIZE + col });
      });
    });
    return locations;
  }, [gridData.activeRows, gridData.activeCols]);

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
       setGridData({ tiles: Array(GRID_SIZE * GRID_SIZE).fill(null), activeRows: [], activeCols: [] });
    }
  }, [landsSqlData, stakesSqlData, loadingSql]);

  // Process auctions
  useEffect(() => {
    if (auctionsSqlData) {
      const filteredAuctions = auctionsSqlData
        .filter((auction: PonziLandAuction) => !auction.is_finished)
        .reduce((acc: Record<number, PonziLandAuction>, auction: PonziLandAuction) => {
          acc[Number(auction.land_location)] = auction;
          return acc;
        }, {});
      setActiveAuctions(filteredAuctions);
      performanceCache.updateAuctionsVersion();
    }
  }, [auctionsSqlData]);

  return {
    gridData,
    activeAuctions,
    tokenInfoCache,
    neighborCache,
    activeTileLocations
  };
};
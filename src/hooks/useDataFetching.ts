import { useState, useCallback, useMemo } from 'react';
import { PonziLand, PonziLandAuction, PonziLandStake, TokenPrice } from '../types/ponziland';
import { performanceCache } from '../utils/performanceCache';
import { comparePricesArrays } from '../utils/smartDiff';
import { logError } from '../utils/errorHandler';
import { apiClient } from '../utils/apiClient';
import { useAdaptivePolling } from '../utils/adaptivePolling';

export const useDataFetching = () => {
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [landsSqlData, setLandsSqlData] = useState<PonziLand[]>([]);
  const [auctionsSqlData, setAuctionsSqlData] = useState<PonziLandAuction[]>([]);
  const [stakesSqlData, setStakesSqlData] = useState<PonziLandStake[]>([]);
  const [loadingSql, setLoadingSql] = useState(true);
  const [errorSql, setErrorSql] = useState<string>('');

  // Price fetching with adaptive polling
  const fetchPrices = useCallback(async () => {
    try {
      const data = await apiClient.fetchPrices();
      
      setPrices(prevPrices => {
        if (!comparePricesArrays(prevPrices, data)) {
          performanceCache.updatePricesVersion();
          return data;
        }
        return prevPrices;
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Normal cancellation
      }
      
      logError('PRICE_FETCH', error, {
        component: 'useDataFetching',
        operation: 'fetchPrices'
      });
    }
  }, []);

  // SQL data fetching with adaptive polling
  const fetchSqlData = useCallback(async () => {
    try {
      // Clear error on any attempt (not just initial)
      setErrorSql('');

      const { lands, auctions, stakes } = await apiClient.fetchSqlData();
      
      setLandsSqlData(lands || []);
      setAuctionsSqlData(auctions || []);
      setStakesSqlData(stakes || []);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Normal cancellation
      }
      
      const errorMessage = `Failed to fetch SQL datasets: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logError('SQL_FETCH_ALL', error, {
        component: 'useDataFetching',
        operation: 'fetchSqlData'
      });
      setErrorSql(errorMessage);
    } finally {
      // Always set loading to false after first attempt
      setLoadingSql(false);
    }
  }, []); // Remove loadingSql dependency to prevent unnecessary restarts

  // Memoize polling configs to prevent unnecessary restarts
  const pricePollingConfig = useMemo(() => ({
    baseInterval: 30000, // 30 seconds
    maxInterval: 120000, // 2 minutes max
    minInterval: 15000,  // 15 seconds min
    enableVisibilityOptimization: true,
    enableActivityOptimization: true
  }), []);

  const sqlPollingConfig = useMemo(() => ({
    baseInterval: 5000,  // 5 seconds - fixed interval for background updates
    maxInterval: 5000,   // Keep at 5s to prevent adaptive increases
    minInterval: 5000,   // Keep at 5s to prevent adaptive decreases  
    enableVisibilityOptimization: false, // Disable to maintain 5s regardless of tab visibility
    enableActivityOptimization: false   // Disable to maintain 5s regardless of user activity
  }), []);

  // Setup adaptive polling for prices (30s base interval)
  useAdaptivePolling(fetchPrices, pricePollingConfig, true);

  // Setup polling for SQL data (fixed 5s interval for background updates)
  useAdaptivePolling(fetchSqlData, sqlPollingConfig, true);

  return {
    prices,
    landsSqlData,
    auctionsSqlData,
    stakesSqlData,
    loadingSql,
    errorSql
  };
};
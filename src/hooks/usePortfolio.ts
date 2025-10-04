import { useMemo } from 'react';
import { PonziLand, PonziLandConfig } from '../types/ponziland';
import { CalculationEngine } from '../utils/calculationEngine';
import type { TokenInfo } from '../utils/formatting';

export const usePortfolio = (
  selectedPlayerAddresses: Set<string>,
  gridData: { tiles: (PonziLand | null)[] },
  tokenInfoCache: Map<string, TokenInfo>,
  neighborCache: Map<number, number[]>,
  activeAuctions: Record<number, any>,
  config: PonziLandConfig | null
) => {
  return useMemo(() => {
    if (selectedPlayerAddresses.size === 0) return null;

    const selectedAddresses = Array.from(selectedPlayerAddresses);
    const portfolioLands = gridData.tiles.filter(land => 
      land && land.owner && typeof land.owner === 'string' && selectedAddresses.includes(land.owner.toLowerCase())
    ) as PonziLand[];

    // Return null if no lands found for selected addresses
    if (portfolioLands.length === 0) {
      return null;
    }

    // Use consolidated calculation engine for portfolio metrics
    const portfolioMetrics = CalculationEngine.calculatePortfolioMetrics(
      portfolioLands,
      gridData,
      tokenInfoCache,
      neighborCache,
      activeAuctions,
      config
    );

    return {
      ...portfolioMetrics,
      portfolioLands,
      criticalLands: portfolioMetrics.criticalLands
    };
  }, [selectedPlayerAddresses, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions, config]);
};

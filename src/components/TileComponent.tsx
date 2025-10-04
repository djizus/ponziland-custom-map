import { memo, useMemo, useCallback } from 'react';
import { PonziLand, PonziLandAuction, SelectedTileDetails, PonziLandConfig, YieldInfo, MapLayer } from '../types/ponziland';
import {
  getTokenInfoCached,
  hexToDecimal,
  displayCoordinates,
  formatTimeRemaining,
  convertToSTRK,
  formatStrkAmount,
  BASE_TOKEN_SYMBOL,
  formatTokenAmount,
  normalizeTokenAddress,
  type TokenInfo,
} from '../utils/formatting';
import { getLevelNumber } from '../utils/dataProcessing';
import { 
  calculateTaxInfoCached,
  calculateROI, 
  calculateBurnRate, 
  calculateTotalYieldInfoCached,
  calculatePurchaseRecommendation 
} from '../utils/taxCalculations';
import { calculateAuctionPrice, getElapsedSeconds } from '../utils/auctionUtils';
import { getValueColor } from '../utils/visualUtils';
import { CalculationEngine, LandCalculationContext } from '../utils/calculationEngine';
import {
  Tile,
  TileHeader,
  TileLocation,
  TileLevel,
  CompactTaxInfo,
  StakedInfo,
  AuctionElapsedInfo
} from './PonzilandMap/styles/TileStyles';

// Custom hook for expensive auction calculations using consolidated engine
const useAuctionCalculations = (
  auction: PonziLandAuction | null,
  land: PonziLand | null,
  location: number,
  neighborCache: Map<number, number[]>,
  gridData: any,
  activeAuctions: Record<number, PonziLandAuction>,
  tokenInfoCache: Map<string, TokenInfo>,
  config: PonziLandConfig | null
) => {
  return useMemo(() => {
    if (!auction || !land) {
      return {
        auctionYieldInfo: undefined,
        auctionROIForDetails: undefined,
        currentAuctionPriceForTileDisplay: undefined,
        potentialYieldAuction: undefined
      };
    }

    const currentAuctionPriceForTileDisplay = calculateAuctionPrice(auction);
    
    // Create calculation context
    const context: LandCalculationContext = {
      location,
      land,
      gridData,
      tokenInfoCache,
      neighborCache,
      activeAuctions,
      config
    };

    // Use consolidated calculation engine
    const yieldResult = CalculationEngine.calculateAuctionYield(context, currentAuctionPriceForTileDisplay);
    const potentialYieldAuction = CalculationEngine.calculatePotentialYield(context);
    
    const auctionYieldInfo: YieldInfo = {
      totalYield: yieldResult.totalYield,
      yieldPerHour: yieldResult.yieldPerHour,
      taxPaidTotal: yieldResult.taxPaidTotal
    };
    
    const auctionROIForDetails = currentAuctionPriceForTileDisplay > 0 ? 
      (yieldResult.yieldPerHour / currentAuctionPriceForTileDisplay) * 100 : undefined;
    
    return {
      auctionYieldInfo,
      auctionROIForDetails,
      currentAuctionPriceForTileDisplay,
      potentialYieldAuction
    };
  }, [auction, land, location, neighborCache, gridData.tiles, activeAuctions, tokenInfoCache, config]);
};

interface TileComponentProps {
  row: number;
  col: number;
  location: number;
  land: PonziLand | null;
  auction: PonziLandAuction | null;
  isHighlighted: boolean;
  tokenInfoCache: Map<string, TokenInfo>;
  neighborCache: Map<number, number[]>;
  gridData: any;
  activeAuctions: Record<number, PonziLandAuction>;
  selectedLayer: MapLayer;
  selectedToken: string;
  showNotOwned: boolean;
  hideNotRecommended: boolean;
  durationCapHours: number;
  config: PonziLandConfig | null;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
}

const TileComponent = memo(({ 
  row, col, location, land, auction, isHighlighted, tokenInfoCache, neighborCache, 
  gridData, activeAuctions, selectedLayer, selectedToken, showNotOwned, hideNotRecommended, durationCapHours, config, onTileClick 
}: TileComponentProps) => {
  // Use custom hook for expensive auction calculations
  const auctionCalculations = useAuctionCalculations(
    auction,
    land,
    location,
    neighborCache,
    gridData,
    activeAuctions,
    tokenInfoCache,
    config
  );

  // Extract relevant tiles to minimize dependencies
  const formatStrkValue = useCallback(
    (value: number, decimals = 2) => {
      if (!Number.isFinite(value) || value === 0) {
        return '0';
      }

      const abs = Math.abs(value);
      const dynamicDecimals = abs >= 1
        ? decimals
        : Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1));

      return formatStrkAmount(value, { decimals: dynamicDecimals, compact: true });
    },
    [],
  );

  const formatSignedStrk = useCallback(
    (value: number, decimals = 2) => {
      if (!Number.isFinite(value) || value === 0) {
        return formatStrkValue(0, decimals);
      }
      const sign = value > 0 ? '+' : '-';
      return `${sign}${formatStrkValue(Math.abs(value), decimals)}`;
    },
    [formatStrkValue],
  );

  const landTokenAddress = useMemo(() => (
    land ? normalizeTokenAddress(land.token_used) : ''
  ), [land]);

  const normalizedSelectedToken = useMemo(() => normalizeTokenAddress(selectedToken), [selectedToken]);

  const relevantTileData = useMemo(() => {
    const neighbors = neighborCache.get(location) || [];
    const relevantTiles = neighbors.map(loc => gridData.tiles[loc]).filter(Boolean);
    if (land) relevantTiles.push(land);
    return relevantTiles;
  }, [location, neighborCache, gridData.tiles, land]);

  // Simplified tile calculation logic with auction calculations extracted
  const tileData = useMemo(() => {
    const { symbol, ratio, decimals } = getTokenInfoCached(land?.token_used || '', tokenInfoCache);
    
    const taxInfo = calculateTaxInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions, config);
    const yieldInfo = calculateTotalYieldInfoCached(
      location,
      gridData.tiles,
      tokenInfoCache,
      neighborCache,
      activeAuctions,
      durationCapHours,
      config,
    );
    const landPriceSTRK = land ? convertToSTRK(land.sell_price, symbol, ratio, decimals) : 0;
    const saleTokenAmount = land
      ? symbol === BASE_TOKEN_SYMBOL
        ? landPriceSTRK
        : ratio && ratio > 0
          ? landPriceSTRK * ratio
          : undefined
      : undefined;
    const burnRate = land ? calculateBurnRate(land, gridData.tiles, activeAuctions, tokenInfoCache, neighborCache, config) : 0;
    const stakedTokenAmount = land ? hexToDecimal(land.staked_amount || '0x0', decimals) : 0;
    const stakedValueSTRK = land
      ? ratio && ratio > 0
        ? convertToSTRK(land.staked_amount || '0x0', symbol, ratio, decimals)
        : stakedTokenAmount
      : 0;
    const timeRemainingHours = stakedValueSTRK > 0
      ? burnRate > 0
        ? stakedValueSTRK / burnRate
        : Infinity
      : 0;
    const nukableStatus: 'nukable' | 'warning' | false = stakedValueSTRK <= 0
      ? 'nukable'
      : timeRemainingHours * 60 <= 10
        ? 'warning'
        : false;

    // Use auction calculations from hook
    const { auctionYieldInfo, auctionROIForDetails, currentAuctionPriceForTileDisplay, potentialYieldAuction } = auctionCalculations;

    // Calculate comprehensive purchase recommendation using new system
    const purchaseRecommendation = calculatePurchaseRecommendation(
      location,
      land,
      gridData.tiles,
      tokenInfoCache,
      neighborCache,
      activeAuctions,
      auction ? currentAuctionPriceForTileDisplay : undefined,
      Math.min(durationCapHours, 48),
      config
    );

    // Calculate display yield and colors based on selected layer
    let displayYield = 0;
    let effectivePrice = landPriceSTRK;
    let isRecommendedForPurchase = purchaseRecommendation.isRecommended;
    let recommendationMessage = purchaseRecommendation.recommendationReason;
    
    // Calculate net profit for purchasing layer
    const netProfit = purchaseRecommendation.maxYield - purchaseRecommendation.requiredTotalTax - purchaseRecommendation.currentPrice;
    
    // For token layer, check if this tile matches the filter criteria
    const isSelectedTokenTile = selectedLayer === 'token' && normalizedSelectedToken && land && (
      showNotOwned ? landTokenAddress !== normalizedSelectedToken : landTokenAddress === normalizedSelectedToken
    );
    
    if (auction && auctionYieldInfo) {
      effectivePrice = currentAuctionPriceForTileDisplay || 0;
      if (selectedLayer === 'yield') {
        // Purchasing layer: Show net profit
        displayYield = netProfit;
      } else if (selectedLayer === 'token') {
        // Token layer: Show gross return (same as analysis layer)
        displayYield = auctionYieldInfo.totalYield + effectivePrice;
      } else {
        // Analysis layer: Total yield + purchase price
        displayYield = auctionYieldInfo.totalYield + effectivePrice;
      }
    } else {
      if (selectedLayer === 'yield') {
        // Purchasing layer: Show net profit
        displayYield = netProfit;
      } else if (selectedLayer === 'token') {
        // Token layer: Show gross return (same as analysis layer)
        displayYield = yieldInfo.totalYield + landPriceSTRK;
      } else {
        // Analysis layer: Total yield + purchase price
        displayYield = yieldInfo.totalYield + landPriceSTRK;
      }
    }
      
    // For purchasing layer, use net profit for color (or gray for not recommended)
    // For analysis layer, use gross return (total yield + purchase price) for color  
    // For token layer, use gross return for color (same as analysis layer)
    const colorValue = selectedLayer === 'yield' ? 
      (isRecommendedForPurchase ? netProfit : -1) : // -1 will make it gray
      selectedLayer === 'token' ?
        (isSelectedTokenTile ? displayYield : -1) : // Show gross return if selected token, gray otherwise
        (auction && auctionYieldInfo ? 
          auctionYieldInfo.totalYield + (currentAuctionPriceForTileDisplay || 0) : 
          yieldInfo.totalYield + landPriceSTRK);
    
    const valueColor = land ? getValueColor(
      land.sell_price, 
      colorValue
    ) : '#1a1a1a';

    return {
      symbol,
      ratio,
      taxInfo,
      yieldInfo,
      auctionYieldInfo,
      landPriceSTRK,
      burnRate,
      nukableStatus,
      potentialYieldAuction,
      auctionROIForDetails,
      currentAuctionPriceForTileDisplay,
      displayYield,
      effectivePrice,
      valueColor,
      isRecommendedForPurchase,
      recommendationMessage,
      purchaseRecommendation,
      netProfit,
      stakedValueSTRK,
      stakedTokenAmount,
      timeRemainingHours,
      saleTokenAmount,
      tokenDecimals: decimals,
    };
  }, [
    location,
    land,
    auction,
    tokenInfoCache,
    neighborCache,
    relevantTileData,
    activeAuctions,
    selectedLayer,
    normalizedSelectedToken,
    auctionCalculations,
    durationCapHours,
    config,
    landTokenAddress,
    showNotOwned,
  ]);

  const currentTileDetails = useMemo((): SelectedTileDetails => ({
    location,
    coords: displayCoordinates(col, row),
    land,
    auction,
    taxInfo: tileData.taxInfo,
    yieldInfo: tileData.yieldInfo,
    auctionYieldInfo: tileData.auctionYieldInfo,
    symbol: tileData.symbol,
    ratio: tileData.ratio,
    tokenDecimals: tileData.tokenDecimals,
    landPriceSTRK: tileData.landPriceSTRK,
    valueColor: tileData.valueColor,
    isMyLand: isHighlighted,
    burnRate: tileData.burnRate,
    nukableStatus: tileData.nukableStatus,
    potentialYieldAuction: tileData.potentialYieldAuction,
    auctionROI: tileData.auctionROIForDetails,
    purchaseRecommendation: tileData.purchaseRecommendation,
    currentAuctionPriceSTRK: tileData.currentAuctionPriceForTileDisplay,
    stakedTokenAmount: tileData.stakedTokenAmount,
    timeRemainingHours: tileData.timeRemainingHours,
    saleTokenAmount: tileData.saleTokenAmount,
  }), [location, col, row, land, auction, tileData, isHighlighted]);

  const handleClick = useCallback(() => {
    onTileClick(currentTileDetails);
  }, [onTileClick, currentTileDetails]);

  // Check if this tile should be hidden (shown as empty)
  const shouldShowAsEmpty = (selectedLayer === 'yield' && hideNotRecommended && 
    land && !tileData.isRecommendedForPurchase) ||
    (selectedLayer === 'token' && normalizedSelectedToken && land && (
      showNotOwned ? landTokenAddress === normalizedSelectedToken : landTokenAddress !== normalizedSelectedToken
    ));

  return (
    <Tile
      key={`${row}-${col}`}
      data-row={row}
      data-col={col}
      onClick={handleClick}
      $isMyLand={isHighlighted && !shouldShowAsEmpty}
      $level={getLevelNumber(land?.level)} 
      $isEmpty={!!(!land || shouldShowAsEmpty)}
      $valueColor={shouldShowAsEmpty ? '#1a1a1a' : tileData.valueColor}
      $isAuction={!!auction && !shouldShowAsEmpty}
      $isNukable={shouldShowAsEmpty ? false : tileData.nukableStatus}
      $pulseGlowIntensity={0}
      $isRecommendedForPurchase={!shouldShowAsEmpty && tileData.isRecommendedForPurchase}
      $isAnalysisLayer={selectedLayer !== 'yield'}
    >
      <TileLocation>{displayCoordinates(col, row)}</TileLocation>
      {land && !shouldShowAsEmpty && (
        auction ? (
          <>
            <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
            <TileHeader>
              {selectedLayer === 'yield'
                ? tileData.auctionYieldInfo
                  ? (!tileData.isRecommendedForPurchase
                      ? tileData.recommendationMessage
                      : formatSignedStrk(tileData.displayYield, 1))
                  : 'AUCTION'
                : 'AUCTION'}
            </TileHeader>
            <CompactTaxInfo>
              <div>{tileData.currentAuctionPriceForTileDisplay !== undefined ? `${formatStrkValue(tileData.currentAuctionPriceForTileDisplay, 2)} STRK` : 'N/A'}</div>
              {tileData.auctionYieldInfo && (
                <>
                  <div>Yield: {formatSignedStrk(tileData.auctionYieldInfo.yieldPerHour, 2)}/h</div>
                  <div style={{ color: tileData.auctionYieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                    ROI: {tileData.auctionROIForDetails?.toFixed(1) || '0.0'}%/h
                  </div>
                </>
              )}
            </CompactTaxInfo>
            <AuctionElapsedInfo>
              {(() => {
                const elapsed = getElapsedSeconds(auction);
                const hours = Math.floor(elapsed / 3600);
                const minutes = Math.floor((elapsed % 3600) / 60);
                if (hours > 0) {
                  return `${hours}h ${minutes}m`;
                } else {
                  return `${minutes}m`;
                }
              })()}
            </AuctionElapsedInfo>
          </>
        ) : (
          <>
            <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
            <TileHeader>
              {selectedLayer === 'yield' && !tileData.isRecommendedForPurchase
                ? tileData.recommendationMessage
                : tileData.displayYield !== 0
                  ? formatSignedStrk(tileData.displayYield, 1)
                  : ''}
            </TileHeader>
            <CompactTaxInfo>
              {land.sell_price ? (
                <>
                  {(() => {
                    const lines: string[] = [];
                    const basePriceDisplay = `${formatTokenAmount(tileData.landPriceSTRK, { decimals: 2, compact: false })} STRK`;

                    if (
                      tileData.saleTokenAmount !== undefined &&
                      tileData.symbol !== BASE_TOKEN_SYMBOL
                    ) {
                      const formattedTokenAmount = formatTokenAmount(
                        tileData.saleTokenAmount,
                        { decimals: 2 },
                      );
                      lines.push(`${formattedTokenAmount} ${tileData.symbol}`);
                      lines.push(basePriceDisplay);
                    } else {
                      lines.push(basePriceDisplay);
                    }

                    return lines.map((line, idx) => (
                      <div key={`sale-line-${idx}`}>{line}</div>
                    ));
                  })()}
                  <div>Yield: {formatSignedStrk(tileData.yieldInfo.yieldPerHour, 2)}/h</div>
                  <div style={{ color: tileData.yieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                    ROI: {calculateROI(tileData.yieldInfo.yieldPerHour, tileData.landPriceSTRK).toFixed(2)}%/h
                  </div>
                </>
              ) : (
                <div>Not for sale</div>
              )}
            </CompactTaxInfo>
            <StakedInfo $isNukable={tileData.nukableStatus}>
              {tileData.timeRemainingHours === undefined
                ? 'N/A'
                : tileData.timeRemainingHours === Infinity
                  ? '∞'
                  : formatTimeRemaining(tileData.timeRemainingHours)}
            </StakedInfo>
          </>
        )
      )}
    </Tile>
  );
});

TileComponent.displayName = 'TileComponent';

export default TileComponent;

import { memo, useMemo, useCallback } from 'react';
import { PonziLand, PonziLandAuction, SelectedTileDetails, YieldInfo, MapLayer } from '../types/ponziland';
import { 
  getTokenInfoCached,
  formatOriginalPrice, 
  calculateESTRKPrice, 
  displayCoordinates, 
  hexToDecimal, 
  formatTimeRemaining, 
  convertToESTRK 
} from '../utils/formatting';
import { getLevelNumber } from '../utils/dataProcessing';
import { 
  calculateTaxInfoCached,
  calculateROI, 
  calculateBurnRate, 
  isNukable, 
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
  tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>
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
      activeAuctions
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
  }, [auction, land, location, neighborCache, gridData.tiles, activeAuctions, tokenInfoCache]);
};

interface TileComponentProps {
  row: number;
  col: number;
  location: number;
  land: PonziLand | null;
  auction: PonziLandAuction | null;
  isHighlighted: boolean;
  tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>;
  neighborCache: Map<number, number[]>;
  gridData: any;
  activeAuctions: Record<number, PonziLandAuction>;
  selectedLayer: MapLayer;
  selectedToken: string;
  showNotOwned: boolean;
  hideNotRecommended: boolean;
  durationCapHours: number;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
}

const TileComponent = memo(({ 
  row, col, location, land, auction, isHighlighted, tokenInfoCache, neighborCache, 
  gridData, activeAuctions, selectedLayer, selectedToken, showNotOwned, hideNotRecommended, durationCapHours, onTileClick 
}: TileComponentProps) => {
  // Use custom hook for expensive auction calculations
  const auctionCalculations = useAuctionCalculations(
    auction, land, location, neighborCache, gridData, activeAuctions, tokenInfoCache
  );

  // Extract relevant tiles to minimize dependencies
  const relevantTileData = useMemo(() => {
    const neighbors = neighborCache.get(location) || [];
    const relevantTiles = neighbors.map(loc => gridData.tiles[loc]).filter(Boolean);
    if (land) relevantTiles.push(land);
    return relevantTiles;
  }, [location, neighborCache, gridData.tiles, land]);

  // Simplified tile calculation logic with auction calculations extracted
  const tileData = useMemo(() => {
    const { symbol, ratio } = getTokenInfoCached(land?.token_used || '', tokenInfoCache);
    
    const taxInfo = calculateTaxInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions);
    const yieldInfo = calculateTotalYieldInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions);
    const landPriceESTRK = land ? convertToESTRK(land.sell_price, symbol, ratio) : 0;
    const burnRate = land ? calculateBurnRate(land, gridData.tiles, activeAuctions) : 0;
    const nukableStatus = land ? isNukable(land, burnRate) : false;

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
      durationCapHours
    );

    // Calculate display yield and colors based on selected layer
    let displayYield = 0;
    let effectivePrice = landPriceESTRK;
    let isRecommendedForPurchase = purchaseRecommendation.isRecommended;
    let recommendationMessage = purchaseRecommendation.recommendationReason;
    
    // Calculate net profit for purchasing layer
    const netProfit = purchaseRecommendation.maxYield - purchaseRecommendation.requiredTotalTax - purchaseRecommendation.currentPrice;
    
    // For token layer, check if this tile matches the filter criteria
    const isSelectedTokenTile = selectedLayer === 'token' && selectedToken && land && (
      showNotOwned ? land.token_used !== selectedToken : land.token_used === selectedToken
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
        displayYield = yieldInfo.totalYield + landPriceESTRK;
      } else {
        // Analysis layer: Total yield + purchase price
        displayYield = yieldInfo.totalYield + landPriceESTRK;
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
          yieldInfo.totalYield + landPriceESTRK);
    
    const valueColor = land ? getValueColor(
      land.sell_price, 
      colorValue
    ) : '#1a1a1a';

    return {
      symbol, ratio, taxInfo, yieldInfo, auctionYieldInfo, landPriceESTRK, 
      burnRate, nukableStatus, potentialYieldAuction, auctionROIForDetails,
      currentAuctionPriceForTileDisplay, displayYield, effectivePrice, 
      valueColor, isRecommendedForPurchase, recommendationMessage,
      purchaseRecommendation, netProfit
    };
  }, [location, land, auction, tokenInfoCache, neighborCache, relevantTileData, activeAuctions, selectedLayer, selectedToken, auctionCalculations, durationCapHours]);

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
    landPriceESTRK: tileData.landPriceESTRK,
    valueColor: tileData.valueColor,
    isMyLand: isHighlighted,
    burnRate: tileData.burnRate,
    nukableStatus: tileData.nukableStatus,
    potentialYieldAuction: tileData.potentialYieldAuction,
    auctionROI: tileData.auctionROIForDetails,
    purchaseRecommendation: tileData.purchaseRecommendation
  }), [location, col, row, land, auction, tileData, isHighlighted]);

  const handleClick = useCallback(() => {
    onTileClick(currentTileDetails);
  }, [onTileClick, currentTileDetails]);

  // Check if this tile should be hidden (shown as empty)
  const shouldShowAsEmpty = (selectedLayer === 'yield' && hideNotRecommended && 
    land && !tileData.isRecommendedForPurchase) ||
    (selectedLayer === 'token' && selectedToken && land && (
      showNotOwned ? land.token_used === selectedToken : land.token_used !== selectedToken
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
              {selectedLayer === 'yield' ? (
                tileData.auctionYieldInfo ? 
                  (!tileData.isRecommendedForPurchase ? 
                    tileData.recommendationMessage :
                    `${tileData.displayYield > 0 ? '+' : ''}${tileData.displayYield.toFixed(1)}`
                  ) :
                  'AUCTION'
              ) : (
                'AUCTION'
              )}
            </TileHeader>
            <CompactTaxInfo>
              <div>{tileData.currentAuctionPriceForTileDisplay !== undefined ? tileData.currentAuctionPriceForTileDisplay.toFixed(1) : 'N/A'} nftSTRK</div>
              {tileData.auctionYieldInfo && (
                <>
                  <div>Yield: {tileData.auctionYieldInfo.yieldPerHour > 0 ? '+' : ''}{tileData.auctionYieldInfo.yieldPerHour.toFixed(1)}/h</div>
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
              {selectedLayer === 'yield' && !tileData.isRecommendedForPurchase ? 
                tileData.recommendationMessage :
                (tileData.displayYield !== 0 ? 
                  `${tileData.displayYield > 0 ? '+' : ''}${tileData.displayYield.toFixed(1)}` :
                  ''
                )
              }
            </TileHeader>
            <CompactTaxInfo>
              {land.sell_price ? (
                <>
                  <div>{formatOriginalPrice(land.sell_price)} {tileData.symbol}</div>
                  {tileData.symbol !== 'nftSTRK' && tileData.ratio !== null && (
                    <div>{calculateESTRKPrice(land.sell_price, tileData.ratio)} nftSTRK</div>
                  )}
                  <div>Yield: {tileData.yieldInfo.yieldPerHour > 0 ? '+' : ''}{tileData.yieldInfo.yieldPerHour.toFixed(1)}/h</div>
                  <div style={{ color: tileData.yieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                    ROI: {calculateROI(tileData.yieldInfo.yieldPerHour, tileData.landPriceESTRK).toFixed(2)}%/h
                  </div>
                </>
              ) : (
                <div>Not for sale</div>
              )}
            </CompactTaxInfo>
            <StakedInfo $isNukable={tileData.nukableStatus}>
              {formatTimeRemaining(hexToDecimal(land.staked_amount || '0x0') / tileData.burnRate)}
            </StakedInfo>
          </>
        )
      )}
    </Tile>
  );
});

TileComponent.displayName = 'TileComponent';

export default TileComponent;
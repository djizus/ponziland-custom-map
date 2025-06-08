import { PonziLand, PonziLandAuction, PonziLandStake, SelectedTileDetails, TokenPrice, YieldInfo } from '../types/ponziland';
import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';

// Import constants
import { 
  GRID_SIZE, 
  SQL_API_URL, 
  SQL_GET_PONZI_LANDS, 
  SQL_GET_PONZI_LAND_AUCTIONS, 
  SQL_GET_PONZI_LANDS_STAKE,
  AUCTION_DURATION 
} from '../constants/ponziland';

// Import utilities
import { 
  formatRatio, 
  getTokenInfoCached,
  formatOriginalPrice, 
  calculateESTRKPrice, 
  displayCoordinates, 
  hexToDecimal, 
  formatTimeRemaining, 
  convertToESTRK 
} from '../utils/formatting';

import { 
  processGridData, 
  getLevelNumber,
  getNeighborLocations 
} from '../utils/dataProcessing';

import { 
  calculateTaxInfoCached,
  calculateROI, 
  calculateBurnRate, 
  isNukable, 
  calculateTotalYieldInfoCached,
  calculateTimeRemainingHours,
  getTaxRateCached,
  calculatePurchaseRecommendation 
} from '../utils/taxCalculations';

import { performanceCache } from '../utils/performanceCache';
import { comparePricesArrays, compareLandArrays } from '../utils/smartDiff';

import { 
  calculateAuctionPrice, 
  getElapsedSeconds 
} from '../utils/auctionUtils';

import { 
  getValueColor
} from '../utils/visualUtils';

// Import styled components
import { 
  MapWrapper, 
  GridContainer 
} from './PonzilandMap/styles/MapStyles';

import {
  InfoLine
} from './PonzilandMap/styles/PanelStyles';

import {
  Tile,
  TileHeader,
  TileLocation,
  TileLevel,
  CompactTaxInfo,
  StakedInfo,
  AuctionElapsedInfo
} from './PonzilandMap/styles/TileStyles';

// Custom hook for expensive auction calculations
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
    const auctionPriceESTRK = currentAuctionPriceForTileDisplay;
    const neighbors = neighborCache.get(location) || [];
    
    // Calculate potential yield for auction
    let potentialYieldAuction = 0;
    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
        const { symbol, ratio } = getTokenInfoCached(neighbor.token_used, tokenInfoCache);
        const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, symbol, ratio);
        const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
        potentialYieldAuction += neighborPriceESTRK * neighborTaxRate;
      }
    });
    
    // Calculate auction tax received
    let auctionTaxReceived = 0;
    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
        const { symbol, ratio } = getTokenInfoCached(neighbor.token_used, tokenInfoCache);
        const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, symbol, ratio);
        const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
        auctionTaxReceived += neighborPriceESTRK * neighborTaxRate;
      }
    });
    
    const myTaxRate = getTaxRateCached(land.level, location, neighborCache);
    let auctionTaxPaid = 0;
    
    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        auctionTaxPaid += auctionPriceESTRK * myTaxRate;
      }
    });
    
    const auctionYieldPerHour = auctionTaxReceived - auctionTaxPaid;
    
    // Calculate time-based yield
    let longestNeighborDuration = 0;
    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner) {
        const neighborBurnRate = calculateBurnRate(neighbor, gridData.tiles, activeAuctions);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        longestNeighborDuration = Math.max(longestNeighborDuration, neighborTimeRemaining);
      }
    });
    
    const myTimeRemaining = Math.max(longestNeighborDuration, 48);
    let totalYieldReceived = 0;
    let totalTaxPaid = 0;
    
    neighbors.forEach(neighborLoc => {
      const neighbor = gridData.tiles[neighborLoc];
      if (neighbor && !activeAuctions[neighborLoc] && neighbor.owner && neighbor.sell_price) {
        const neighborBurnRate = calculateBurnRate(neighbor, gridData.tiles, activeAuctions);
        const neighborTimeRemaining = calculateTimeRemainingHours(neighbor, neighborBurnRate);
        
        if (neighborTimeRemaining > 0) {
          const { symbol: neighborSymbol, ratio: neighborRatio } = getTokenInfoCached(neighbor.token_used, tokenInfoCache);
          const neighborPriceESTRK = convertToESTRK(neighbor.sell_price, neighborSymbol, neighborRatio);
          const neighborTaxRate = getTaxRateCached(neighbor.level, Number(neighbor.location), neighborCache);
          const neighborHourlyTax = neighborPriceESTRK * neighborTaxRate;
          
          const taxReceivingDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
          totalYieldReceived += neighborHourlyTax * taxReceivingDuration;
          
          const hourlyTaxPaid = auctionPriceESTRK * myTaxRate;
          const taxPaymentDuration = Math.min(myTimeRemaining, neighborTimeRemaining);
          totalTaxPaid += hourlyTaxPaid * taxPaymentDuration;
        }
      }
    });
    
    const netYield = totalYieldReceived - totalTaxPaid - auctionPriceESTRK;
    
    const auctionYieldInfo: YieldInfo = {
      totalYield: netYield,
      yieldPerHour: auctionYieldPerHour,
      taxPaidTotal: totalTaxPaid
    };
    
    const auctionROIForDetails = auctionPriceESTRK > 0 ? (auctionYieldPerHour / auctionPriceESTRK) * 100 : undefined;
    
    return {
      auctionYieldInfo,
      auctionROIForDetails,
      currentAuctionPriceForTileDisplay,
      potentialYieldAuction
    };
  }, [auction, land, location, neighborCache, gridData.tiles, activeAuctions, tokenInfoCache]);
};

// Memoized sidebar components for performance
const SidebarHeader = memo(({ isSidebarCollapsed, onToggle }: { 
  isSidebarCollapsed: boolean; 
  onToggle: () => void; 
}) => (
  <div style={{
    padding: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    {!isSidebarCollapsed && <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Ponziland Analysis</span>}
    <button 
      onClick={onToggle}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontSize: '16px',
        padding: '4px'
      }}
    >
      {isSidebarCollapsed ? '▶' : '◀'}
    </button>
  </div>
));

const TabNavigation = memo(({ activeTab, onTabChange }: {
  activeTab: 'map' | 'analysis';
  onTabChange: (tab: 'map' | 'analysis') => void;
}) => (
  <div style={{
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)'
  }}>
    {[
      { key: 'map', label: '🗺️', title: 'Map & Data' },
      { key: 'analysis', label: '📊', title: 'Analysis & Details' }
    ].map(tab => (
      <button
        key={tab.key}
        onClick={() => onTabChange(tab.key as any)}
        style={{
          flex: 1,
          padding: '8px 4px',
          background: activeTab === tab.key ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '12px',
          transition: 'background 0.2s'
        }}
        title={tab.title}
      >
        {tab.label}
      </button>
    ))}
  </div>
));


// Memoized Tile Component for performance optimization
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
  selectedLayer: 'purchasing' | 'yield';
  hideNotRecommended: boolean;
  durationCapHours: number;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
}

const TileComponent = memo(({ 
  row, col, location, land, auction, isHighlighted, tokenInfoCache, neighborCache, 
  gridData, activeAuctions, selectedLayer, hideNotRecommended, durationCapHours, onTileClick 
}: TileComponentProps) => {
  // Use custom hook for expensive auction calculations
  const auctionCalculations = useAuctionCalculations(
    auction, land, location, neighborCache, gridData, activeAuctions, tokenInfoCache
  );

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
    
    if (auction && auctionYieldInfo) {
      effectivePrice = currentAuctionPriceForTileDisplay || 0;
      if (selectedLayer === 'yield') {
        // Purchasing layer: Show net profit
        displayYield = netProfit;
      } else {
        // Analysis layer: Total yield + purchase price
        displayYield = auctionYieldInfo.totalYield + effectivePrice;
      }
    } else {
      if (selectedLayer === 'yield') {
        // Purchasing layer: Show net profit
        displayYield = netProfit;
      } else {
        // Analysis layer: Total yield + purchase price
        displayYield = yieldInfo.totalYield + landPriceESTRK;
      }
    }
      
    // For purchasing layer, use net profit for color (or gray for not recommended)
    // For analysis layer, use gross return (total yield + purchase price) for color
    const colorValue = selectedLayer === 'yield' ? 
      (isRecommendedForPurchase ? netProfit : -1) : // -1 will make it gray
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
  }, [location, land, auction, tokenInfoCache, neighborCache, gridData.tiles, activeAuctions, selectedLayer, auctionCalculations, durationCapHours]);

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
  const shouldShowAsEmpty = selectedLayer === 'yield' && hideNotRecommended && 
    land && !tileData.isRecommendedForPurchase;

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

const PonzilandMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom] = useState(1);
  const [prices, setPrices] = useState<TokenPrice[]>([]);

  // New state for SQL fetched data
  const [landsSqlData, setLandsSqlData] = useState<PonziLand[]>([]);
  const [auctionsSqlData, setAuctionsSqlData] = useState<PonziLandAuction[]>([]);
  const [stakesSqlData, setStakesSqlData] = useState<PonziLandStake[]>([]);
  const [loadingSql, setLoadingSql] = useState(true);
  const [errorSql, setErrorSql] = useState<string | null>(null);
  
  const [gridData, setGridData] = useState<{
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
  }>({ tiles: [], activeRows: [], activeCols: [] });
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});
  // Load persisted state from localStorage
  const loadPersistedState = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [selectedPlayerAddresses, setSelectedPlayerAddresses] = useState<Set<string>>(
    () => new Set(loadPersistedState<string[]>('ponziland-selected-players', []))
  );
  
  // Unified sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => loadPersistedState<boolean>('ponziland-sidebar-collapsed', false)
  );
  const [activeTab, setActiveTab] = useState<'map' | 'analysis'>(
    () => loadPersistedState<'map' | 'analysis'>('ponziland-active-tab', 'map')
  );
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});
  const [allPlayers, setAllPlayers] = useState<Array<{ address: string; displayName: string; originalAddress: string }>>([]);
  const [selectedTileData, setSelectedTileData] = useState<SelectedTileDetails | null>(null);
  
  // Layer selection state
  const [selectedLayer, setSelectedLayer] = useState<'purchasing' | 'yield'>(
    () => loadPersistedState<'purchasing' | 'yield'>('ponziland-selected-layer', 'purchasing')
  );
  
  // Hide not recommended tiles toggle
  const [hideNotRecommended, setHideNotRecommended] = useState(
    () => loadPersistedState<boolean>('ponziland-hide-not-recommended', false)
  );
  
  // Duration cap for yield collection and tax payment (2-24 hours)
  const [durationCapHours, setDurationCapHours] = useState(
    () => loadPersistedState<number>('ponziland-duration-cap', 12)
  );
  

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

  // Performance optimization: Memoize tile click handler
  const handleTileClick = useCallback((tileDetails: SelectedTileDetails) => {
    setSelectedTileData(tileDetails);
    setActiveTab('analysis');
    // Always open the sidebar when a tile is clicked
    setIsSidebarCollapsed(false);
  }, []);

  // Performance optimization: Memoize sidebar callbacks
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const handleTabChange = useCallback((tab: 'map' | 'analysis') => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/price');
        const data = await response.json();
        
        // Only update if data has actually changed
        setPrices(prevPrices => {
          if (!comparePricesArrays(prevPrices, data)) {
            performanceCache.updatePricesVersion();
            return data;
          }
          return prevPrices;
        });
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices(); // Initial fetch
    const interval = setInterval(fetchPrices, 30000); // Reduced frequency: every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchSql = async <T,>(query: string, queryName: string): Promise<T[]> => {
      const encodedQuery = encodeURIComponent(query);
      const fullUrl = `${SQL_API_URL}?query=${encodedQuery}`;

      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SQL Query HTTP Error for ${queryName}`, {
            status: response.status,
            statusText: response.statusText,
            url: fullUrl,
            errorResponseText: errorText,
          });
          throw new Error(`SQL HTTP Error (${queryName}): ${response.status} ${response.statusText}. Details: ${errorText.substring(0, 200)}`);
        }
        const result = await response.json();
        return result as T[]; 
      } catch (error: any) {
        console.error(`Full error in fetchSql for ${queryName} (URL: ${fullUrl}):`, error);
        const errorMessage = error.message || `An unexpected error occurred in fetchSql for ${queryName}.`;
        throw new Error(errorMessage);
      }
    };

    const fetchAllSqlData = async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setLoadingSql(true);
      }
      setErrorSql(null);

      try {
        const [landsResult, auctionsResult, stakesResult] = await Promise.all([
          fetchSql<PonziLand>(SQL_GET_PONZI_LANDS, "GetPonziLands"),
          fetchSql<PonziLandAuction>(SQL_GET_PONZI_LAND_AUCTIONS, "GetPonziLandAuctions"),
          fetchSql<PonziLandStake>(SQL_GET_PONZI_LANDS_STAKE, "GetPonziLandsStake"),
        ]);
        
        setLandsSqlData(landsResult || []);
        setAuctionsSqlData(auctionsResult || []);
        setStakesSqlData(stakesResult || []);

      } catch (err: any) {
        console.error('Error in fetchAllSqlData:', err);
        setErrorSql(err.message || 'Failed to fetch one or more SQL datasets');
      } finally {
        if (isInitialLoad) {
          setLoadingSql(false);
        }
      }
    };

    fetchAllSqlData(true); // Initial fetch with loading indicator
    const intervalId = setInterval(() => fetchAllSqlData(false), 5000); // Frequent updates: every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

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

  useEffect(() => {
    document.title = "Ponziland ROI Map";
  }, []);

  // Persistence effects - save state changes to localStorage
  useEffect(() => {
    localStorage.setItem('ponziland-selected-players', JSON.stringify(Array.from(selectedPlayerAddresses)));
  }, [selectedPlayerAddresses]);


  useEffect(() => {
    localStorage.setItem('ponziland-selected-layer', JSON.stringify(selectedLayer));
  }, [selectedLayer]);

  useEffect(() => {
    localStorage.setItem('ponziland-hide-not-recommended', JSON.stringify(hideNotRecommended));
  }, [hideNotRecommended]);

  useEffect(() => {
    localStorage.setItem('ponziland-sidebar-collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('ponziland-active-tab', JSON.stringify(activeTab));
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('ponziland-duration-cap', JSON.stringify(durationCapHours));
  }, [durationCapHours]);

  useEffect(() => {
    if (gridData.tiles.length === 0 && !loadingSql) {
      setAllPlayers([]);
      return;
    }

    const ownerAddressesFromMap = new Set<string>();
    gridData.tiles.forEach(tile => {
      if (tile?.owner) {
        ownerAddressesFromMap.add(tile.owner);
      }
    });

    const addressesToFetchUsernamesFor: string[] = [];
    
    ownerAddressesFromMap.forEach(mapOwnerAddr => {
      if (!usernameCache[mapOwnerAddr.toLowerCase()]) {
        addressesToFetchUsernamesFor.push(mapOwnerAddr);
      }
    });
    
    if (addressesToFetchUsernamesFor.length > 0) {
      const fetchUsernamesForSpecificAddresses = async () => {
        try {
          const response = await fetch('/api/usernames', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: addressesToFetchUsernamesFor }),
          });
          if (response.ok) {
            const fetchedData = await response.json();
            setUsernameCache(prevCache => {
              const newCache = { ...prevCache };
              if (Array.isArray(fetchedData)) {
                fetchedData.forEach((item: {username: string, address: string}) => {
                  if (item.address && item.username) {
                    newCache[item.address.toLowerCase()] = item.username;
                  }
                });
              } else {
                Object.assign(newCache, fetchedData);
              }
              return newCache;
            });
          } else {
            // console.error("Failed to fetch usernames:", await response.text());
          }
        } catch (error) {
          // console.error("Error fetching usernames:", error);
        }
      };
      fetchUsernamesForSpecificAddresses();
    }

    const uniqueOwnerEntriesForPlayerList = new Map<string, { address: string; displayName: string; originalAddress: string }>();
    ownerAddressesFromMap.forEach(mapOwnerAddr => {
      const addrKey = mapOwnerAddr.toLowerCase();
      const username = usernameCache[addrKey];
      if (!uniqueOwnerEntriesForPlayerList.has(addrKey)) {
          uniqueOwnerEntriesForPlayerList.set(addrKey, {
            address: addrKey,
            originalAddress: mapOwnerAddr, 
            displayName: username || `${mapOwnerAddr.slice(0,6)}...${mapOwnerAddr.slice(-4)}`
        });
      }
    });

    const sortedPlayers = Array.from(uniqueOwnerEntriesForPlayerList.values()).sort((a,b) => a.displayName.localeCompare(b.displayName));
    setAllPlayers(sortedPlayers);

  }, [gridData.tiles, usernameCache, loadingSql]);


  if (loadingSql) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>Loading Ponziland Data...</div>;
  if (errorSql && landsSqlData.length === 0) { 
    return <div style={{ color: 'red', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>Error loading data: {errorSql}</div>;
  }

  const handlePlayerSelectionChange = (address: string, isSelected: boolean) => {
    setSelectedPlayerAddresses(prevSelected => {
      const newSelected = new Set(prevSelected);
      const addrKey = address.toLowerCase(); // Use toLowerCase for Set consistency
      if (isSelected) {
        newSelected.add(addrKey);
      } else {
        newSelected.delete(addrKey);
      }
      return newSelected;
    });
  };

  return (
    <MapWrapper ref={mapRef}>
      {errorSql && !loadingSql && landsSqlData.length > 0 && 
        <div style={{
          position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255, 0, 0, 0.7)', color: 'white', padding: '5px 10px', 
          borderRadius: '5px', zIndex: 2000, fontSize: '12px'
        }}>
          Update failed: {errorSql.length > 50 ? errorSql.substring(0,50)+"..." : errorSql} (showing previous data)
        </div>
      }
      {/* Unified Sidebar */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: isSidebarCollapsed ? '50px' : '280px',
        height: 'calc(100vh - 40px)',
        background: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sidebar Header */}
        <SidebarHeader 
          isSidebarCollapsed={isSidebarCollapsed} 
          onToggle={handleSidebarToggle}
        />

        {!isSidebarCollapsed && (
          <>
            {/* Tab Navigation */}
            <TabNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

            {/* Tab Content */}
            <div style={{
              flex: 1,
              padding: '12px',
              overflow: 'auto'
            }}>
              {activeTab === 'map' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Map Layers Section */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>MAP LAYERS</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '4px',
                        borderRadius: '4px',
                        background: selectedLayer === 'purchasing' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}>
                        <input 
                          type="radio" 
                          name="layer"
                          checked={selectedLayer === 'purchasing'}
                          onChange={() => setSelectedLayer('purchasing')}
                          style={{ margin: 0, width: '12px', height: '12px' }}
                        />
                        Analysis Layer
                      </label>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '4px',
                        borderRadius: '4px',
                        background: selectedLayer === 'yield' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                      }}>
                        <input 
                          type="radio" 
                          name="layer"
                          checked={selectedLayer === 'yield'}
                          onChange={() => setSelectedLayer('yield')}
                          style={{ margin: 0, width: '12px', height: '12px' }}
                        />
                        Purchasing Layer
                      </label>
                      
                      {/* Hide Not Recommended Toggle - only show when purchasing layer is selected */}
                      {selectedLayer === 'yield' && (
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '4px 4px 4px 20px',
                          borderRadius: '4px',
                          marginTop: '4px',
                          color: '#bbb'
                        }}>
                          <input 
                            type="checkbox"
                            checked={hideNotRecommended}
                            onChange={(e) => setHideNotRecommended(e.target.checked)}
                            style={{ margin: 0, width: '11px', height: '11px' }}
                          />
                          Hide not recommended
                        </label>
                      )}

                      {/* Duration Cap Slider */}
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '11px', 
                          color: '#bbb',
                          marginBottom: '6px'
                        }}>
                          Max Holding Duration: {durationCapHours}h
                        </label>
                        <input
                          type="range"
                          min="2"
                          max="24"
                          step="1"
                          value={durationCapHours}
                          onChange={(e) => setDurationCapHours(Number(e.target.value))}
                          style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            outline: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontSize: '10px', 
                          color: '#666',
                          marginTop: '2px'
                        }}>
                          <span>2h</span>
                          <span>24h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>

                  {/* Land Owners Section */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>LAND OWNERS</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflow: 'auto' }}>
                      {allPlayers.map(player => (
                        <label key={player.address} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: selectedPlayerAddresses.has(player.address) ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedPlayerAddresses.has(player.address)}
                            onChange={(e) => handlePlayerSelectionChange(player.address, e.target.checked)}
                            style={{ margin: 0, width: '12px', height: '12px' }}
                          />
                          <span style={{ 
                            color: selectedPlayerAddresses.has(player.address) ? '#FFD700' : 'white',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {player.displayName}
                          </span>
                        </label>
                      ))}
                      {allPlayers.length === 0 && loadingSql && (
                        <p style={{ textAlign: 'center', fontSize: '11px', color: '#888', margin: '8px 0' }}>
                          Loading players...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>

                  {/* Token Prices Section */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>TOKEN PRICES</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflow: 'auto' }}>
                      {prices
                        .filter(token => token.symbol !== 'nftSTRK')
                        .sort((a, b) => (a.ratio || 0) - (b.ratio || 0))
                        .map(token => (
                          <div key={token.address} style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            alignItems: 'center',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            <span style={{ color: 'white' }}>nftSTRK</span>
                            <span style={{ color: '#4CAF50', textAlign: 'center', padding: '0 8px' }}>
                              {token.ratio !== null ? formatRatio(token.ratio) : 'N/A'}
                            </span>
                            <span style={{ color: 'white' }}>{token.symbol}</span>
                          </div>
                        ))}
                      {prices.length === 0 && (
                        <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', padding: '20px' }}>
                          Loading prices...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedTileData ? (
                    <>
                      {/* Tile Header */}
                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '8px', 
                        borderRadius: '4px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
                          Location {selectedTileData.location} {selectedTileData.coords} - Level {selectedTileData.land ? getLevelNumber(selectedTileData.land.level) : 'N/A'}
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                          {selectedTileData.auction ? "AUCTION" : 
                            (selectedTileData.land?.owner ? 
                              `${(usernameCache[selectedTileData.land.owner.toLowerCase()] || selectedTileData.land.owner.slice(0,4)+"..."+selectedTileData.land.owner.slice(-3))}` : 
                              (selectedTileData.land ? "Unowned" : "Empty")
                            )}
                        </div>
                        {selectedTileData.isMyLand && (
                          <div style={{ color: 'gold', fontWeight: 'bold', marginTop: '4px', fontSize: '11px' }}>
                            ★ Highlighted Land
                          </div>
                        )}
                      </div>

                      {selectedTileData.land ? (
                        <>
                          {/* Purchase Recommendations Section */}
                          {(selectedTileData.land.sell_price || selectedTileData.auction) && (
                            <div>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>PURCHASE RECOMMENDATIONS</h4>
                              <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(() => {
                                  const recommendation = selectedTileData.purchaseRecommendation;
                                  
                                  if (!recommendation) {
                                    return (
                                      <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', padding: '10px 0' }}>
                                        Recommendation data not available
                                      </div>
                                    );
                                  }
                                  
                                  if (!recommendation.isRecommended) {
                                    return (
                                      <div style={{ fontSize: '11px', color: '#ff6b6b', textAlign: 'center', padding: '10px 0' }}>
                                        Not recommended: {recommendation.recommendationReason}
                                      </div>
                                    );
                                  }
                                  
                                  // Calculate net profit (gross yield - taxes - purchase price)
                                  const netProfit = recommendation.maxYield - recommendation.requiredTotalTax - recommendation.currentPrice;
                                  
                                  return (
                                    <>
                                      <InfoLine>
                                        <span>Current Ask:</span>
                                        <span style={{ color: 'white' }}>{recommendation.currentPrice.toFixed(1)} nftSTRK</span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Max Yield ({durationCapHours}h):</span>
                                        <span style={{ color: '#4CAF50' }}>{recommendation.maxYield.toFixed(1)} nftSTRK</span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Recommended Price:</span>
                                        <span style={{ color: '#4CAF50' }}>{recommendation.recommendedPrice.toFixed(1)} nftSTRK</span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Required Stake:</span>
                                        <span style={{ color: '#ff9800' }}>{recommendation.requiredStakeForFullYield.toFixed(1)} nftSTRK</span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Net Profit:</span>
                                        <span style={{ color: netProfit > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {netProfit > 0 ? '+' : ''}{netProfit.toFixed(1)} nftSTRK
                                        </span>
                                      </InfoLine>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Divider if both sections exist */}
                          {(selectedTileData.land.sell_price || selectedTileData.auction) && (
                            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                          )}

                          {/* Detailed Analysis Section */}
                          <div style={{ fontSize: '11px' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>DETAILED ANALYSIS</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {selectedTileData.auction ? (
                                <>
                                  <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4CAF50' }}>Yield Analysis</div>
                                    {selectedTileData.auctionYieldInfo ? (
                                      <>
                                        <InfoLine>
                                          <span>Price:</span>
                                          <span style={{ color: 'white' }}>{calculateAuctionPrice(selectedTileData.auction).toFixed(2)} nftSTRK</span>
                                        </InfoLine>
                                        <InfoLine>
                                          <span>Gross Return:</span>
                                          <span style={{ color: (selectedTileData.auctionYieldInfo.totalYield + calculateAuctionPrice(selectedTileData.auction)) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                            {(selectedTileData.auctionYieldInfo.totalYield + calculateAuctionPrice(selectedTileData.auction)) > 0 ? '+':''}
                                            {(selectedTileData.auctionYieldInfo.totalYield + calculateAuctionPrice(selectedTileData.auction)).toFixed(1)} nftSTRK
                                          </span>
                                        </InfoLine>
                                        <InfoLine>
                                          <span>Yield/Hour:</span>
                                          <span style={{ color: selectedTileData.auctionYieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                            {selectedTileData.auctionYieldInfo.yieldPerHour > 0 ? '+':''}
                                            {selectedTileData.auctionYieldInfo.yieldPerHour.toFixed(1)}/h
                                          </span>
                                        </InfoLine>
                                        {selectedTileData.auctionROI !== undefined && (
                                          <InfoLine>
                                            <span>ROI:</span>
                                            <span style={{ color: selectedTileData.auctionROI > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                              {selectedTileData.auctionROI.toFixed(1)}%/h
                                            </span>
                                          </InfoLine>
                                        )}
                                        <InfoLine>
                                          <span>Ends In:</span>
                                          <span>{(() => {
                                            const elapsed = getElapsedSeconds(selectedTileData.auction);
                                            const remaining = AUCTION_DURATION - elapsed;
                                            if (remaining <=0) return "Ended";
                                            const hours = Math.floor(remaining / 3600);
                                            const minutes = Math.floor((remaining % 3600) / 60);
                                            if (hours > 0) return `${hours}h ${minutes}m`;
                                            return `${minutes}m`;
                                          })()}</span>
                                        </InfoLine>
                                      </>
                                    ) : (
                                      <InfoLine>
                                        <span>Price:</span>
                                        <span>{calculateAuctionPrice(selectedTileData.auction).toFixed(2)} nftSTRK</span>
                                      </InfoLine>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4CAF50' }}>Yield Analysis</div>
                                    <InfoLine>
                                      <span>Price:</span>
                                      <span style={{ color: 'white' }}>
                                        {selectedTileData.land.sell_price ? 
                                          `${selectedTileData.landPriceESTRK.toFixed(2)} nftSTRK` : 
                                          'Not for sale'
                                        }
                                      </span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Gross Return:</span>
                                      <span style={{ color: (selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceESTRK) > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                        {(selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceESTRK) > 0 ? '+':''}
                                        {(selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceESTRK).toFixed(1)} nftSTRK
                                      </span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Yield/Hour:</span>
                                      <span style={{ color: selectedTileData.yieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                        {selectedTileData.yieldInfo.yieldPerHour > 0 ? '+':''}
                                        {selectedTileData.yieldInfo.yieldPerHour.toFixed(1)}/h
                                      </span>
                                    </InfoLine>
                                    {selectedTileData.landPriceESTRK > 0 && (
                                      <InfoLine>
                                        <span>ROI:</span>
                                        <span style={{ color: calculateROI(selectedTileData.yieldInfo.yieldPerHour, selectedTileData.landPriceESTRK) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {calculateROI(selectedTileData.yieldInfo.yieldPerHour, selectedTileData.landPriceESTRK).toFixed(1)}%/h
                                        </span>
                                      </InfoLine>
                                    )}
                                  </div>

                                  <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#7cb3ff' }}>Staking Info</div>
                                    <InfoLine>
                                      <span>Amount:</span>
                                      <span>{hexToDecimal(selectedTileData.land.staked_amount || '0x0').toFixed(2)} {selectedTileData.symbol}</span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Burn Rate:</span>
                                      <span>{selectedTileData.burnRate > 0 ? selectedTileData.burnRate.toFixed(2) : '0.00'}/h</span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Time Remaining:</span>
                                      <span style={{
                                        color: selectedTileData.nukableStatus === 'nukable' ? '#ff6b6b' : (selectedTileData.nukableStatus === 'warning' ? 'orange' : '#4CAF50'),
                                        fontWeight: selectedTileData.nukableStatus !== false ? 'bold' : 'normal'
                                      }}>
                                        {selectedTileData.burnRate > 0 ? formatTimeRemaining(hexToDecimal(selectedTileData.land.staked_amount || '0x0') / selectedTileData.burnRate) : (hexToDecimal(selectedTileData.land.staked_amount || '0x0') > 0 ? '∞' : 'N/A')}
                                      </span>
                                    </InfoLine>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#888', padding: '20px', fontSize: '11px' }}>
                          This is an empty plot of land.
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', padding: '20px' }}>
                      Click on a tile to see analysis and details
                    </div>
                  )}
                </div>
              )}


            </div>

            {/* Play Ponziland Button - Always visible at bottom */}
            <div style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <a 
                href="https://play.ponzi.land/game" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #4CAF50, #45a049)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #45a049, #3d8b40)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🎮 Play Ponziland
              </a>
            </div>
          </>
        )}
      </div>

      <GridContainer
        zoom={zoom}
        style={{
          gridTemplateColumns: `repeat(${gridData.activeCols.length}, 100px)`,
          gridTemplateRows: `repeat(${gridData.activeRows.length}, 100px)`,
          marginLeft: isSidebarCollapsed ? '90px' : '320px',
          transition: 'margin-left 0.3s ease'
        }}
      >
        {activeTileLocations.map(({ row, col, location }) => {
          const land = gridData.tiles[location];
          const auction = activeAuctions[location];
          const isHighlighted = land?.owner ? selectedPlayerAddresses.has(land.owner.toLowerCase()) : false;

          return (
            <TileComponent
              key={`${row}-${col}`}
              row={row}
              col={col}
              location={location}
              land={land}
              auction={auction}
              isHighlighted={isHighlighted}
              tokenInfoCache={tokenInfoCache}
              neighborCache={neighborCache}
              gridData={gridData}
              activeAuctions={activeAuctions}
              selectedLayer={selectedLayer}
              hideNotRecommended={hideNotRecommended}
              durationCapHours={durationCapHours}
              onTileClick={handleTileClick}
            />
          );
        })}
      </GridContainer>
    </MapWrapper>
  );
};

export default PonzilandMap; 
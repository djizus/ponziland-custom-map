import { PonziLand, PonziLandAuction, PonziLandStake, SelectedTileDetails, TokenPrice } from '../../types/ponziland';
import { useEffect, useState, useRef, useMemo } from 'react';

// Import constants
import { 
  GRID_SIZE, 
  SQL_API_URL, 
  SQL_GET_PONZI_LANDS, 
  SQL_GET_PONZI_LAND_AUCTIONS, 
  SQL_GET_PONZI_LANDS_STAKE,
  AUCTION_DURATION 
} from '../../constants/ponziland';

// Import utilities
import { 
  formatRatio, 
  getTokenInfoCached,
  formatOriginalPrice, 
  calculateESTRKPrice, 
  displayCoordinates, 
  hexToDecimal, 
  formatTimeRemaining, 
  formatYield,
  convertToESTRK 
} from '../../utils/formatting';

import { 
  processGridData, 
  getLevelNumber,
  getNeighborLocations 
} from '../../utils/dataProcessing';

import { 
  calculateROI, 
  calculateBurnRate, 
  isNukable, 
  calculatePotentialYield,
  calculateTotalYieldInfoCached,
  calculateTaxInfoCached
} from '../../utils/taxCalculations';

import { 
  calculateAuctionPrice, 
  getElapsedSeconds 
} from '../../utils/auctionUtils';

import { 
  getValueColor, 
  getOpportunityColor 
} from '../../utils/visualUtils';

// Import styled components
import { 
  MapWrapper, 
  GridContainer, 
  GameLink 
} from './styles/MapStyles';

import {
  PanelHeader,
  MinimizeButton,
  PlayerListPanel,
  PlayerListContent,
  ZoomControls,
  ZoomControlsRow,
  ZoomButton,
  ZoomLevel,
  PriceDisplay,
  PriceRow,
  TokenSymbol,
  TokenValue,
  PriceHeader,
  TileInfoPanelWrapper,
  InfoLine
} from './styles/PanelStyles';

import {
  Tile,
  TileHeader,
  TileLocation,
  TileLevel,
  CompactTaxInfo,
  StakedInfo,
  AuctionElapsedInfo
} from './styles/TileStyles';

const PonzilandMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
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
  const [isPriceMinimized, setIsPriceMinimized] = useState(false);
  const [activeAuctions, setActiveAuctions] = useState<Record<number, PonziLandAuction>>({});
  const [selectedPlayerAddresses, setSelectedPlayerAddresses] = useState<Set<string>>(new Set());
  const [isPlayerListMinimized, setIsPlayerListMinimized] = useState(false);
  const [isZoomMinimized, setIsZoomMinimized] = useState(false);
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});
  const [allPlayers, setAllPlayers] = useState<Array<{ address: string; displayName: string; originalAddress: string }>>([]);
  const [selectedTileData, setSelectedTileData] = useState<SelectedTileDetails | null>(null);

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

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/price');
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices(); // Initial fetch
    const interval = setInterval(fetchPrices, 5000); // Refresh every 5 seconds

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
    const intervalId = setInterval(() => fetchAllSqlData(false), 5000); // Polls without full loading indicator

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (landsSqlData && stakesSqlData && landsSqlData.length > 0) {
      setGridData(processGridData(landsSqlData, stakesSqlData));
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
    }
  }, [auctionsSqlData]);

  useEffect(() => {
    document.title = "Ponziland ROI Map";
  }, []);

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

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

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

  const handleTileClick = (tileDetails: SelectedTileDetails) => {
    setSelectedTileData(tileDetails);
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
      <PlayerListPanel $isMinimized={isPlayerListMinimized}>
        <PanelHeader
          $isMinimized={isPlayerListMinimized}
          onClick={() => setIsPlayerListMinimized(!isPlayerListMinimized)}
        >
          Players
          <MinimizeButton>
            {isPlayerListMinimized ? '+' : '−'}
          </MinimizeButton>
        </PanelHeader>
        <PlayerListContent className="player-list-content">
          {allPlayers.map(player => {
            return (
              <label key={player.address}> 
                <input 
                  type="checkbox" 
                  checked={selectedPlayerAddresses.has(player.address)}
                  onChange={(e) => handlePlayerSelectionChange(player.originalAddress, e.target.checked)}
                />
                {player.displayName} 
                <span className="player-address">({player.originalAddress.slice(0,4)}...{player.originalAddress.slice(-3)})</span> 
              </label>
            );
          })}
          {allPlayers.length === 0 && !loadingSql && <p style={{textAlign: 'center', fontSize: '11px', color: '#888'}}>
             No players found on map.
            </p>}
          {allPlayers.length === 0 && loadingSql && <p style={{textAlign: 'center', fontSize: '11px', color: '#888'}}>
             Loading players...
            </p>}
        </PlayerListContent>
      </PlayerListPanel>
      <ZoomControls $isMinimized={isZoomMinimized}>
        <PanelHeader
          $isMinimized={isZoomMinimized}
          onClick={() => setIsZoomMinimized(!isZoomMinimized)}
        >
          Zoom
          <MinimizeButton>
            {isZoomMinimized ? '+' : '−'}
          </MinimizeButton>
        </PanelHeader>
        <div className="zoom-controls">
          <ZoomControlsRow>
            <ZoomButton onClick={() => handleZoom(-0.1)}>−</ZoomButton>
            <ZoomLevel>{Math.round(zoom * 100)}%</ZoomLevel>
            <ZoomButton onClick={() => handleZoom(0.1)}>+</ZoomButton>
          </ZoomControlsRow>
        </div>
      </ZoomControls>

      <GridContainer
        zoom={zoom}
        style={{
          gridTemplateColumns: `repeat(${gridData.activeCols.length}, 100px)`,
          gridTemplateRows: `repeat(${gridData.activeRows.length}, 100px)`
        }}
      >
         {gridData.activeRows.map(row =>
          gridData.activeCols.map(col => {
            const location = row * GRID_SIZE + col;
            const land = gridData.tiles[location];
            const auction = activeAuctions[location];
            const isHighlighted = land?.owner ? selectedPlayerAddresses.has(land.owner.toLowerCase()) : false;
            const { symbol, ratio } = getTokenInfoCached(land?.token_used || '', tokenInfoCache);
            
            const taxInfo = calculateTaxInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions);
            const landPriceESTRK = land ? convertToESTRK(land.sell_price, symbol, ratio) : 0;
            const valueColor = land ? getValueColor(
              land.sell_price, 
              taxInfo.profitPerHour
            ) : '#1a1a1a';
            
            const opportunityColor = getOpportunityColor(taxInfo.profitPerHour, landPriceESTRK);
            const burnRate = land ? calculateBurnRate(land, gridData.tiles, activeAuctions) : 0;
            const nukableStatus = land ? isNukable(land, burnRate) : false;
            const potentialYieldAuction = auction ? calculatePotentialYield(Number(land?.location), gridData.tiles, prices, activeAuctions) : undefined;

            // Add auctionROI calculation
            let auctionROIForDetails: number | undefined = undefined;
            let currentAuctionPriceForTileDisplay: number | undefined = undefined;

            if (auction) {
                currentAuctionPriceForTileDisplay = calculateAuctionPrice(auction);
                const currentYield = potentialYieldAuction || 0;
                // Only calculate and show ROI if price is positive and yield is positive
                if (currentAuctionPriceForTileDisplay > 0 && currentYield > 0) {
                    auctionROIForDetails = (currentYield / currentAuctionPriceForTileDisplay) * 100;
                }
            }

            const yieldInfo = calculateTotalYieldInfoCached(location, gridData.tiles, tokenInfoCache, neighborCache, activeAuctions);
            
            const currentTileDetails: SelectedTileDetails = {
              location,
              coords: displayCoordinates(col, row),
              land,
              auction,
              taxInfo,
              yieldInfo,
              symbol,
              ratio,
              landPriceESTRK,
              valueColor,
              opportunityColor,
              isMyLand: isHighlighted,
              burnRate,
              nukableStatus,
              potentialYieldAuction,
              auctionROI: auctionROIForDetails
            };

            return (
              <Tile
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                onClick={() => handleTileClick(currentTileDetails)}
                $isMyLand={isHighlighted}
                $level={getLevelNumber(land?.level)} 
                $isEmpty={!land}
                $valueColor={valueColor}
                $isAuction={!!auction}
                $opportunityColor={opportunityColor}
                $isNukable={nukableStatus}
                $auctionYield={potentialYieldAuction}
              >
                <TileLocation>{displayCoordinates(col, row)}</TileLocation>
                {land && (
                  auction ? (
                    <>
                      <TileLevel>L{getLevelNumber(land.level)}</TileLevel>
                      <TileHeader>AUCTION</TileHeader>
                      <CompactTaxInfo>
                        <div>Yield: {formatYield(potentialYieldAuction || 0)}</div>
                        <div>{currentAuctionPriceForTileDisplay !== undefined ? currentAuctionPriceForTileDisplay.toFixed(2) : 'N/A'} nftSTRK</div>
                        {auctionROIForDetails !== undefined && (
                          <div style={{ color: auctionROIForDetails > 0 ? '#4CAF50' : (auctionROIForDetails < 0 ? '#ff6b6b' : 'white') }}>
                            ROI: {auctionROIForDetails.toFixed(1)}%/h
                          </div>
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
                        {taxInfo.profitPerHour !== 0 ? 
                          `${taxInfo.profitPerHour > 0 ? '+' : ''}${taxInfo.profitPerHour.toFixed(1)}/h` :
                          symbol
                        }
                      </TileHeader>
                      <CompactTaxInfo>
                        {land.sell_price ? (
                          <>
                            <div>{formatOriginalPrice(land.sell_price)} {symbol}</div>
                            {symbol !== 'nftSTRK' && ratio !== null && (
                              <div>{calculateESTRKPrice(land.sell_price, ratio)} nftSTRK</div>
                            )}
                            {symbol !== 'nftSTRK' && ratio === null && (
                              <div>Price unavailable</div>
                            )}
                            {(taxInfo.taxPaid > 0 || taxInfo.taxReceived > 0) && (
                              <>
                                <div>
                                  {taxInfo.taxPaid > 0 && `-${taxInfo.taxPaid.toFixed(1)}`}
                                  {taxInfo.taxPaid > 0 && taxInfo.taxReceived > 0 && ' | '}
                                  {taxInfo.taxReceived > 0 && `+${taxInfo.taxReceived.toFixed(1)}`}
                                </div>
                                <div style={{ color: taxInfo.profitPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                  ROI: {calculateROI(taxInfo.profitPerHour, landPriceESTRK).toFixed(2)}%/h
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div>Not for sale</div>
                        )}
                      </CompactTaxInfo>
                      <StakedInfo $isNukable={nukableStatus}>
                        {formatTimeRemaining(hexToDecimal(land.staked_amount || '0x0') / burnRate)}
                      </StakedInfo>
                    </>
                  )
                )}
              </Tile>
            );
          })
        )}
      </GridContainer>
      <PriceDisplay $isMinimized={isPriceMinimized}>
        <PriceHeader 
          $isMinimized={isPriceMinimized}
          onClick={() => setIsPriceMinimized(!isPriceMinimized)}
        >
          Token Prices
          <MinimizeButton>
            {isPriceMinimized ? '+' : '−'}
          </MinimizeButton>
        </PriceHeader>
        {prices
          .filter(token => token.symbol !== 'nftSTRK')
          .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
          .map(token => (
            <PriceRow key={token.address}>
              <TokenSymbol>{token.symbol}</TokenSymbol>
              <TokenValue>
                {token.ratio !== null ? formatRatio(token.ratio) : 'N/A'} nftSTRK
              </TokenValue>
            </PriceRow>
          ))}
      </PriceDisplay>
      <GameLink href="https://play.ponzi.land/game" target="_blank" rel="noopener noreferrer">
        🎮 Play Ponziland
      </GameLink>

      {selectedTileData && (
        <TileInfoPanelWrapper>
          <button className="close-button" onClick={() => setSelectedTileData(null)}>&times;</button>
          <h3>
            {selectedTileData.coords} (L{selectedTileData.land ? getLevelNumber(selectedTileData.land.level) : 'N/A'}) 
            {selectedTileData.auction ? "- AUCTION" : 
              (selectedTileData.land?.owner ? 
                `- ${(usernameCache[selectedTileData.land.owner.toLowerCase()] || selectedTileData.land.owner.slice(0,4)+"..."+selectedTileData.land.owner.slice(-3))}` : 
                (selectedTileData.land ? "- Unowned" : "- Empty")
              )}
          </h3>
          
          {selectedTileData.isMyLand && <p style={{ color: 'gold', fontWeight: 'bold' }}>★ Highlighted Land {(selectedTileData.land?.owner && usernameCache[selectedTileData.land.owner.toLowerCase()]) || ''}</p>}

          {selectedTileData.land ? (
            <>
              {selectedTileData.auction ? (
                <div className="info-section">
                  <h4>Auction</h4>
                  <InfoLine>
                    <span>Price:</span>
                    <span>{calculateAuctionPrice(selectedTileData.auction).toFixed(2)} nftSTRK</span>
                  </InfoLine>
                  <InfoLine>
                    <span>Yield:</span>
                    <span style={{ color: (selectedTileData.potentialYieldAuction || 0) > 0 ? '#4CAF50' : 'white' }}>
                      {formatYield(selectedTileData.potentialYieldAuction || 0)}
                    </span>
                  </InfoLine>
                  {/* Display Auction ROI in Info Panel */}
                  {selectedTileData.auctionROI !== undefined && (
                    <InfoLine>
                      <span>ROI/hr:</span>
                      <span style={{ color: selectedTileData.auctionROI > 0 ? '#4CAF50' : (selectedTileData.auctionROI < 0 ? '#ff6b6b' : 'white')}}>
                        {selectedTileData.auctionROI.toFixed(1)}%
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
                </div>
              ) : (
                <>
                  <div className="info-section">
                    <h4>Finances</h4>
                    <InfoLine>
                      <span>Profit/hr:</span>
                      <span style={{ color: selectedTileData.taxInfo.profitPerHour > 0 ? '#4CAF50' : (selectedTileData.taxInfo.profitPerHour < 0 ? '#ff6b6b' : 'white')}}>
                        {selectedTileData.taxInfo.profitPerHour > 0 ? '+':''}{selectedTileData.taxInfo.profitPerHour.toFixed(1)}/h
                      </span>
                    </InfoLine>
                    {selectedTileData.land.sell_price ? (
                      <>
                        <InfoLine>
                          <span>Price:</span>
                          <span>{formatOriginalPrice(selectedTileData.land.sell_price)} {selectedTileData.symbol}</span>
                        </InfoLine>
                        {selectedTileData.symbol !== 'nftSTRK' && selectedTileData.ratio !== null && (
                          <InfoLine>
                            <span>Value:</span>
                            <span>{calculateESTRKPrice(selectedTileData.land.sell_price, selectedTileData.ratio)} nftSTRK</span>
                          </InfoLine>
                        )}
                        {selectedTileData.landPriceESTRK > 0 && (
                           <InfoLine>
                            <span>ROI/hr:</span>
                            <span style={{ color: calculateROI(selectedTileData.taxInfo.profitPerHour, selectedTileData.landPriceESTRK) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                              {calculateROI(selectedTileData.taxInfo.profitPerHour, selectedTileData.landPriceESTRK).toFixed(1)}%
                            </span>
                          </InfoLine>
                        )}
                      </>
                    ) : (
                      <InfoLine>
                        <span>Price:</span>
                        <span>Not for sale</span>
                      </InfoLine>
                    )}
                  </div>

                  <div className="info-section">
                    <h4>Staking</h4>
                    <InfoLine>
                      <span>Staked:</span>
                      <span>{hexToDecimal(selectedTileData.land.staked_amount || '0x0').toFixed(2)} {selectedTileData.symbol}</span>
                    </InfoLine>
                    <InfoLine>
                      <span>Burn/hr:</span>
                      <span>{selectedTileData.burnRate > 0 ? selectedTileData.burnRate.toFixed(2) : '0.00'} {selectedTileData.symbol}</span>
                    </InfoLine>
                    <InfoLine>
                      <span>Time Left:</span>
                      <span style={{
                        color: selectedTileData.nukableStatus === 'nukable' ? '#ff6b6b' : (selectedTileData.nukableStatus === 'warning' ? 'orange' : '#4CAF50'),
                        fontWeight: selectedTileData.nukableStatus !== false ? 'bold' : 'normal'
                      }}>
                        {selectedTileData.burnRate > 0 ? formatTimeRemaining(hexToDecimal(selectedTileData.land.staked_amount || '0x0') / selectedTileData.burnRate) : (hexToDecimal(selectedTileData.land.staked_amount || '0x0') > 0 ? '∞ (no burn)' : 'N/A')}
                      </span>
                    </InfoLine>
                  </div>

                  {(selectedTileData.taxInfo.taxPaid > 0 || selectedTileData.taxInfo.taxReceived > 0) && (
                    <div className="info-section">
                      <h4>Tax Details</h4>
                      <InfoLine>
                        <span>Paid/hr:</span>
                        <span>-{selectedTileData.taxInfo.taxPaid.toFixed(1)}</span>
                      </InfoLine>
                      <InfoLine>
                        <span>Recv/hr:</span>
                        <span>+{selectedTileData.taxInfo.taxReceived.toFixed(1)}</span>
                      </InfoLine>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <p>This is an empty plot of land.</p>
          )}
        </TileInfoPanelWrapper>
      )}
    </MapWrapper>
  );
};

export default PonzilandMap; 
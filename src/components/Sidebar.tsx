import { memo, useMemo, useCallback } from 'react';
import { SelectedTileDetails, TokenPrice, PonziLandConfig, MapLayer } from '../types/ponziland';
import { PlayerStats } from '../hooks/usePlayerStats';
import { AUCTION_DURATION } from '../constants/ponziland';
import {
  formatRatio,
  formatTimeRemaining,
  BASE_TOKEN_SYMBOL,
  normalizeTokenAddress,
  formatTokenAmount,
} from '../utils/formatting';
import { getTokenMetadata } from '../data/tokenMetadata';
import { calculateAuctionPrice, getElapsedSeconds } from '../utils/auctionUtils';
import { calculateROI } from '../utils/taxCalculations';
import { getLevelNumber } from '../utils/dataProcessing';
import {
  SidebarContainer,
  SidebarHeader as StyledSidebarHeader,
  SidebarTitle,
  TabNavigation,
  TabContent,
  ActionSection,
  PlayButton,
  ControlsSection,
  ControlGroup,
  LayerSelector,
  LayerOption,
  DurationControls,
  DurationOptions,
  PlayerList,
  PlayerItem,
  PlayerName,
  PlayerCheckbox,
  LoadingMessage,
  TokenList,
  TokenItem,
  TokenSymbol,
  TokenRatio,
  TokenTarget,
  AnalysisContent,
  SidebarTileHeader,
  TileTitle,
  TileSubtitle,
  InfoLine,
  InfoLabel,
  InfoValue,
  EmptyState,
  CompactCheckbox,
  TabButton
} from './PonzilandMap/styles';

// Simplified sidebar header - always visible
const SidebarHeaderComponent = memo(() => (
  <StyledSidebarHeader>
    <SidebarTitle>Ponziland Analysis</SidebarTitle>
  </StyledSidebarHeader>
));

const TabNavigationComponent = memo(({ activeTab, onTabChange, tabConfig }: {
  activeTab: 'map' | 'analysis';
  onTabChange: (tab: 'map' | 'analysis') => void;
  tabConfig: Array<{ key: 'map' | 'analysis'; label: string; title: string }>;
}) => (
  <TabNavigation>
    {tabConfig.map(tab => (
      <TabButton
        key={tab.key}
        onClick={() => onTabChange(tab.key as any)}
        $isActive={activeTab === tab.key}
        title={tab.title}
        style={{ flex: 1 }}
      >
        {tab.label}
      </TabButton>
    ))}
  </TabNavigation>
));

interface SidebarProps {
  activeTab: 'map' | 'analysis';
  selectedLayer: MapLayer;
  selectedToken: string;
  selectedStakeToken: string;
  showNotOwned: boolean;
  durationCapHours: number;
  prices: TokenPrice[];
  allPlayers: Array<{ address: string; displayName: string; originalAddress: string }>;
  selectedPlayerAddresses: Set<string>;
  selectedTileData: SelectedTileDetails | null;
  usernameCache: Record<string, string>;
  loadingSql: boolean;
  playerStats: PlayerStats;
  config: PonziLandConfig | null;
  onTabChange: (tab: 'map' | 'analysis') => void;
  onLayerChange: (layer: MapLayer) => void;
  onTokenChange: (token: string) => void;
  onStakeTokenChange: (token: string) => void;
  onShowNotOwnedChange: (show: boolean) => void;
  onDurationCapChange: (hours: number) => void;
  onPlayerSelectionChange: (address: string, isSelected: boolean) => void;
}

const Sidebar = memo(({
  activeTab,
  selectedLayer,
  selectedToken,
  selectedStakeToken,
  showNotOwned,
  durationCapHours,
  prices,
  allPlayers,
  selectedPlayerAddresses,
  selectedTileData,
  usernameCache,
  loadingSql,
  playerStats,
  config,
  onTabChange,
  onLayerChange,
  onTokenChange,
  onStakeTokenChange,
  onShowNotOwnedChange,
  onDurationCapChange,
  onPlayerSelectionChange
}: SidebarProps) => {
  const formatStrkValue = useCallback((value: number, decimals = 2) => {
    if (!Number.isFinite(value) || value === 0) {
      return '0';
    }

    const abs = Math.abs(value);
    const dynamicDecimals = abs >= 1
      ? decimals
      : Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1));

    return value.toLocaleString('en-US', {
      minimumFractionDigits: dynamicDecimals,
      maximumFractionDigits: dynamicDecimals,
      useGrouping: false,
    });
  }, []);
  const formatSignedStrk = useCallback((value: number, decimals = 2) => {
    if (!Number.isFinite(value) || value === 0) {
      return '0';
    }
    const sign = value > 0 ? '+' : '-';
    return `${sign}${formatStrkValue(Math.abs(value), decimals)}`;
  }, [formatStrkValue]);

  const formatValueInToken = useCallback(
    (valueStrk: number, tokenAddress?: string, preferToken = false) => {
      const formattedStrk = `${formatStrkValue(valueStrk, 2)} STRK`;
      const normalizedAddress = normalizeTokenAddress(tokenAddress);
      if (!Number.isFinite(valueStrk) || !normalizedAddress) {
        return formattedStrk;
      }

      const token = prices.find(p => normalizeTokenAddress(p.address) === normalizedAddress);
      if (!token || token.symbol === BASE_TOKEN_SYMBOL || !token.ratio || token.ratio <= 0) {
        return formattedStrk;
      }

      const tokenAmount = valueStrk * token.ratio;
      const metadata = getTokenMetadata(token.address);
      const formattedToken = formatTokenAmount(tokenAmount, metadata?.decimals ?? 6);

      if (preferToken) {
        return `${formattedToken} ${token.symbol} (${formattedStrk})`;
      }

      return `${formattedStrk} (${formattedToken} ${token.symbol})`;
    },
    [prices, formatStrkValue],
  );

  const landTokenAddress = useMemo(() => (
    selectedTileData?.land ? normalizeTokenAddress(selectedTileData.land.token_used) : ''
  ), [selectedTileData?.land]);

  const stakeConversionAddress = useMemo(() => {
    const selected = normalizeTokenAddress(selectedStakeToken);
    if (selected) return selected;
    return landTokenAddress;
  }, [selectedStakeToken, landTokenAddress]);

  const stakingDisplay = useMemo(() => {
    if (!selectedTileData?.land) {
      return {
        amount: `${formatStrkValue(0, 2)} STRK`,
        burnRate: `${formatStrkValue(0, 2)} STRK/h`,
        timeRemaining: undefined as number | undefined,
      };
    }

    const stakedStrk = selectedTileData.stakedValueSTRK ?? 0;
    const burnRateStrk = selectedTileData.burnRate ?? 0;
    const tokenAmount = selectedTileData.stakedTokenAmount ?? 0;
    const timeRemaining = selectedTileData.timeRemainingHours;

    const landPrice = prices.find(p => normalizeTokenAddress(p.address) === landTokenAddress);
    const landMetadata = getTokenMetadata(landTokenAddress);
    const tokenSymbol = landPrice?.symbol
      ?? landMetadata?.symbol
      ?? (landTokenAddress ? selectedTileData.symbol : BASE_TOKEN_SYMBOL);
    const tokenDecimals = landMetadata?.decimals ?? selectedTileData.tokenDecimals ?? 6;

    const tokenIsStrk = tokenSymbol.toUpperCase() === BASE_TOKEN_SYMBOL;

    const burnRateToken = burnRateStrk > 0 && tokenAmount > 0 && stakedStrk > 0
      ? burnRateStrk * (tokenAmount / stakedStrk)
      : 0;

    const amountTokenStr = `${formatTokenAmount(tokenAmount, tokenDecimals)} ${tokenSymbol}`;
    const burnTokenStr = `${formatTokenAmount(burnRateToken, tokenDecimals)} ${tokenSymbol}`;

    const effectiveStrk = stakedStrk > 0
      ? stakedStrk
      : (tokenIsStrk ? tokenAmount : 0);

    const amount = tokenIsStrk
      ? `${formatStrkValue(effectiveStrk, 2)} STRK`
      : tokenAmount > 0 && effectiveStrk > 0
        ? `${amountTokenStr} (${formatStrkValue(effectiveStrk, 2)} STRK)`
        : tokenAmount > 0
          ? amountTokenStr
          : `${formatStrkValue(effectiveStrk, 2)} STRK`;

    const effectiveBurnStrk = burnRateStrk > 0
      ? burnRateStrk
      : (tokenIsStrk ? burnRateToken : 0);

    const burnRate = tokenIsStrk
      ? `${formatStrkValue(effectiveBurnStrk, 2)} STRK/h`
      : burnRateToken > 0 && effectiveBurnStrk > 0
        ? `${burnTokenStr} (${formatStrkValue(effectiveBurnStrk, 2)} STRK)/h`
        : burnRateToken > 0
          ? `${burnTokenStr}/h`
          : `${formatStrkValue(effectiveBurnStrk, 2)} STRK/h`;

    return {
      amount,
      burnRate,
      timeRemaining,
    };
  }, [selectedTileData, landTokenAddress, prices, formatStrkValue]);
  // Memoize tab configuration to avoid recreation
  const tabConfig = useMemo(() => [
    { key: 'map' as const, label: '🗺️', title: 'Map & Data' },
    { key: 'analysis' as const, label: '📊', title: 'Analysis & Details' }
  ], []);

  // Memoize sorted prices (include all tokens)
  const sortedPrices = useMemo(() => 
    prices.sort((a, b) => {
      // Put STRK first
      if (a.symbol === 'STRK') return -1;
      if (b.symbol === 'STRK') return 1;
      return (a.ratio || 0) - (b.ratio || 0);
    })
  , [prices]);

  // Memoize player list with selection state
  const playerListItems = useMemo(() =>
    allPlayers.map(player => ({
      ...player,
      isSelected: selectedPlayerAddresses.has(player.address)
    }))
  , [allPlayers, selectedPlayerAddresses]);

  // Memoize event handlers for hover effects
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(0)';
  }, []);
  const resolvedAuctionDuration = config?.auction_duration ?? AUCTION_DURATION;
  const currentAuctionPrice = selectedTileData?.auction
    ? selectedTileData.currentAuctionPriceSTRK ?? calculateAuctionPrice(selectedTileData.auction, config || undefined)
    : undefined;

  return (
    <SidebarContainer>
      {/* Sidebar Header */}
      <SidebarHeaderComponent />

      {/* Tab Navigation */}
      <TabNavigationComponent 
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabConfig={tabConfig}
      />

      {/* Tab Content */}
      <TabContent>
            {activeTab === 'map' && (
              <ControlsSection>
                {/* Map Layers Section */}
                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>MAP LAYERS</h4>
                  <LayerSelector>
                    <LayerOption $isSelected={selectedLayer === 'purchasing'}>
                      <CompactCheckbox 
                        type="radio" 
                        name="layer"
                        checked={selectedLayer === 'purchasing'}
                        onChange={() => onLayerChange('purchasing')}
                      />
                      Analysis Layer
                    </LayerOption>
                    <LayerOption $isSelected={selectedLayer === 'yield'}>
                      <CompactCheckbox 
                        type="radio" 
                        name="layer"
                        checked={selectedLayer === 'yield'}
                        onChange={() => onLayerChange('yield')}
                      />
                      Purchasing Layer
                    </LayerOption>
                    <LayerOption $isSelected={selectedLayer === 'token'}>
                      <CompactCheckbox 
                        type="radio" 
                        name="layer"
                        checked={selectedLayer === 'token'}
                        onChange={() => onLayerChange('token')}
                      />
                      Token Layer
                    </LayerOption>
                    

                  </LayerSelector>
                </ControlGroup>

                {/* Token Selector - only show when token layer is selected */}
                {selectedLayer === 'token' && (
                  <ControlGroup>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>SELECT TOKEN</h4>
                    <select
                      value={normalizeTokenAddress(selectedToken)}
                      onChange={(e) => onTokenChange(normalizeTokenAddress(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        color: 'white',
                        fontSize: '12px'
                      }}
                    >
                      <option value="" disabled>Choose a token...</option>
                      {sortedPrices.map(token => {
                        const optionValue = normalizeTokenAddress(token.address);
                        return (
                          <option key={token.address} value={optionValue} style={{ backgroundColor: '#333' }}>
                            {token.symbol}
                          </option>
                        );
                      })}
                    </select>
                    <LayerOption style={{ fontSize: '11px', marginTop: '8px', color: '#bbb' }}>
                      <CompactCheckbox 
                        type="checkbox"
                        checked={showNotOwned}
                        onChange={(e) => onShowNotOwnedChange(e.target.checked)}
                      />
                      Show lands NOT using this token
                    </LayerOption>
                  </ControlGroup>
                )}

                {/* Duration Cap Slider - only show for purchasing layer */}
                {selectedLayer === 'yield' && (
                  <ControlGroup>
                    <DurationControls>
                      <InfoLabel style={{ display: 'block', marginBottom: '6px' }}>
                        Max Holding Duration: {durationCapHours}h
                      </InfoLabel>
                        <input
                          type="range"
                          min="2"
                          max="48"
                          step="1"
                          value={durationCapHours}
                          onChange={(e) => onDurationCapChange(Number(e.target.value))}
                          style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            outline: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        />
                      <DurationOptions>
                        <span>2h</span>
                        <span>48h</span>
                      </DurationOptions>
                    </DurationControls>
                  </ControlGroup>
                )}

                {/* Land Owners Section */}
                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>LAND OWNERS</h4>
                  <PlayerList>
                    {playerListItems.map(player => (
                      <PlayerItem key={player.address} $isSelected={player.isSelected}>
                        <PlayerCheckbox
                          type="checkbox"
                          checked={player.isSelected}
                          onChange={(e) => onPlayerSelectionChange(player.address, e.target.checked)}
                        />
                        <PlayerName $isSelected={player.isSelected}>
                          {player.displayName}
                        </PlayerName>
                      </PlayerItem>
                    ))}
                    {allPlayers.length === 0 && loadingSql && (
                      <LoadingMessage>
                        Loading players...
                      </LoadingMessage>
                    )}
                  </PlayerList>
                </ControlGroup>

                {/* Player Stats Section - only show when players are selected */}
                {selectedPlayerAddresses.size > 0 && (
                  <ControlGroup>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>PLAYER STATS</h4>
                    
                    {/* Portfolio Stats */}
                    <div style={{ marginBottom: '12px' }}>
                      <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#aaa' }}>Portfolio</h5>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Lands Owned:</InfoLabel>
                        <InfoValue>{playerStats.totalLandsOwned}</InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Portfolio Value:</InfoLabel>
                        <InfoValue>{formatStrkValue(playerStats.totalPortfolioValue, 1)} STRK</InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Staked Value:</InfoLabel>
                        <InfoValue>{formatStrkValue(playerStats.totalStakedValue, 1)} STRK</InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Total Yield:</InfoLabel>
                        <InfoValue style={{ color: playerStats.totalYield > 0 ? '#4CAF50' : '#ff6b6b' }}>
                          {formatSignedStrk(playerStats.totalYield, 1)} STRK
                        </InfoValue>
                      </InfoLine>
                    </div>

                    {/* Performance Metrics */}
                    <div style={{ marginBottom: '12px' }}>
                      <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#aaa' }}>Performance</h5>
                      {playerStats.bestPerformingLand && (
                        <InfoLine style={{ marginBottom: '4px' }}>
                          <InfoLabel>Best Land:</InfoLabel>
                          <InfoValue style={{ color: '#4CAF50' }}>
                            {playerStats.bestPerformingLand.display}
                          </InfoValue>
                        </InfoLine>
                      )}
                      {playerStats.worstPerformingLand && (
                        <InfoLine style={{ marginBottom: '4px' }}>
                          <InfoLabel>Worst Land:</InfoLabel>
                          <InfoValue style={{ color: '#ff6b6b' }}>
                            {playerStats.worstPerformingLand.display}
                          </InfoValue>
                        </InfoLine>
                      )}
                    </div>

                    {/* Risk Assessment */}
                    {playerStats.nukableRiskLands.length > 0 && (
                      <div>
                        <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#ff6b6b' }}>⚠️ Risk Alert</h5>
                        {playerStats.nukableRiskLands.map((riskLand) => (
                          <InfoLine key={riskLand.location} style={{ marginBottom: '4px' }}>
                            <InfoLabel>{riskLand.display}:</InfoLabel>
                            <InfoValue style={{ color: '#ff6b6b' }}>
                              {riskLand.timeRemaining.toFixed(1)}h left
                            </InfoValue>
                          </InfoLine>
                        ))}
                      </div>
                    )}
                  </ControlGroup>
                )}

                {/* Token Prices Section */}
                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>TOKEN PRICES</h4>
                  <TokenList>
                    {sortedPrices.map(token => (
                      <TokenItem key={token.address}>
                        <TokenSymbol>STRK</TokenSymbol>
                        <TokenRatio>
                          {token.symbol === 'STRK' ? '1.00' : (token.ratio !== null ? formatRatio(token.ratio) : 'N/A')}
                        </TokenRatio>
                        <TokenTarget>{token.symbol}</TokenTarget>
                      </TokenItem>
                    ))}
                    {prices.length === 0 && (
                      <LoadingMessage style={{ padding: '20px' }}>
                        Loading prices...
                      </LoadingMessage>
                    )}
                  </TokenList>
                </ControlGroup>
              </ControlsSection>
            )}

            {activeTab === 'analysis' && (
              <AnalysisContent>
                {selectedTileData ? (
                  <>
                    {/* Tile Header */}
                    <SidebarTileHeader>
                      <TileTitle>
                        Location {selectedTileData.location} {selectedTileData.coords} - Level {selectedTileData.land ? getLevelNumber(selectedTileData.land.level) : 'N/A'}
                      </TileTitle>
                      <TileSubtitle>
                        {selectedTileData.auction ? "AUCTION" : 
                          (selectedTileData.land?.owner ? 
                            `${(usernameCache[selectedTileData.land.owner.toLowerCase()] || selectedTileData.land.owner.slice(0,4)+"..."+selectedTileData.land.owner.slice(-3))}` : 
                            (selectedTileData.land ? "Unowned" : "Empty")
                          )}
                      </TileSubtitle>
                      {selectedTileData.isMyLand && (
                        <div style={{ color: 'gold', fontWeight: 'bold', marginTop: '4px', fontSize: '11px' }}>
                          ★ Highlighted Land
                        </div>
                      )}
                    </SidebarTileHeader>

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
                                    {/* Stake Token Selector */}
                                    <div style={{ marginBottom: '8px' }}>
                                      <InfoLabel style={{ display: 'block', marginBottom: '4px' }}>Stake Token:</InfoLabel>
                                     <select
                                        value={stakeConversionAddress}
                                        onChange={(e) => onStakeTokenChange(normalizeTokenAddress(e.target.value))}
                                        style={{
                                          width: '100%',
                                          padding: '6px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                          border: '1px solid rgba(255, 255, 255, 0.2)',
                                          borderRadius: '4px',
                                          color: 'white',
                                          fontSize: '11px'
                                        }}
                                      >
                                        {sortedPrices.map(token => (
                                          <option key={token.address} value={normalizeTokenAddress(token.address)} style={{ backgroundColor: '#333' }}>
                                            {token.symbol} ({token.symbol === 'STRK' ? '1.00' : formatRatio(token.ratio)})
                                          </option>
                                        ))}
                                      </select>
                                   </div>
                                    
                                    <InfoLine>
                                      <InfoLabel>Current Ask:</InfoLabel>
                                      <InfoValue>
                                        {formatValueInToken(
                                          recommendation.currentPrice,
                                          landTokenAddress,
                                          true,
                                        )}
                                      </InfoValue>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Max Yield ({durationCapHours}h):</span>
                                      <span style={{ color: '#4CAF50' }}>{formatStrkValue(recommendation.maxYield, 1)} STRK</span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Recommended Price:</span>
                                      <span style={{ color: '#03a9f4' }}>
                                        {formatValueInToken(
                                          recommendation.recommendedPrice,
                                          stakeConversionAddress,
                                          true,
                                        )}
                                      </span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Required Stake:</span>
                                      <span style={{ color: '#ff9800' }}>
                                        {formatValueInToken(
                                          recommendation.requiredStakeForFullYield,
                                          stakeConversionAddress,
                                          true,
                                        )}
                                      </span>
                                    </InfoLine>
                                    <InfoLine>
                                      <span>Net Profit:</span>
                                      <span style={{ color: netProfit > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                        {formatSignedStrk(netProfit, 1)} STRK
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
                                        <span style={{ color: 'white' }}>
                                          {currentAuctionPrice !== undefined ? `${formatStrkValue(currentAuctionPrice, 2)} STRK` : 'N/A'}
                                        </span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Gross Return:</span>
                                        <span style={{ color: (selectedTileData.auctionYieldInfo.totalYield + (currentAuctionPrice || 0)) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {formatSignedStrk(selectedTileData.auctionYieldInfo.totalYield + (currentAuctionPrice || 0), 1)} STRK
                                        </span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Yield/Hour:</span>
                                        <span style={{ color: selectedTileData.auctionYieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {formatSignedStrk(selectedTileData.auctionYieldInfo.yieldPerHour, 1)}/h
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
                                          const duration = selectedTileData.auctionDurationSeconds || resolvedAuctionDuration;
                                          const remaining = duration - elapsed;
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
                                        <span>{currentAuctionPrice !== undefined ? `${formatStrkValue(currentAuctionPrice, 2)} STRK` : 'N/A'}</span>
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
                                        `${formatStrkValue(selectedTileData.landPriceSTRK, 2)} STRK` : 
                                        'Not for sale'
                                      }
                                    </span>
                                  </InfoLine>
                                  <InfoLine>
                                    <span>Gross Return:</span>
                                    <span style={{ color: (selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceSTRK) > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                      {formatSignedStrk(selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceSTRK, 1)} STRK
                                    </span>
                                  </InfoLine>
                                  <InfoLine>
                                    <span>Yield/Hour:</span>
                                    <span style={{ color: selectedTileData.yieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                      {formatSignedStrk(selectedTileData.yieldInfo.yieldPerHour, 1)}/h
                                    </span>
                                  </InfoLine>
                                  {selectedTileData.landPriceSTRK > 0 && (
                                    <InfoLine>
                                      <span>ROI:</span>
                                      <span style={{ color: calculateROI(selectedTileData.yieldInfo.yieldPerHour, selectedTileData.landPriceSTRK) > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                        {calculateROI(selectedTileData.yieldInfo.yieldPerHour, selectedTileData.landPriceSTRK).toFixed(1)}%/h
                                      </span>
                                    </InfoLine>
                                  )}
                                </div>

                              <div>
                                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#7cb3ff' }}>Staking Info</div>
                                  <InfoLine>
                                    <span>Amount:</span>
                                    <span>{stakingDisplay.amount}</span>
                                  </InfoLine>
                                  <InfoLine>
                                    <span>Burn Rate:</span>
                                    <span>{stakingDisplay.burnRate}</span>
                                  </InfoLine>
                                <InfoLine>
                                  <span>Time Remaining:</span>
                                  <span style={{
                                    color: selectedTileData.nukableStatus === 'nukable' ? '#ff6b6b' : (selectedTileData.nukableStatus === 'warning' ? 'orange' : '#4CAF50'),
                                    fontWeight: selectedTileData.nukableStatus !== false ? 'bold' : 'normal'
                                  }}>
                                      {stakingDisplay.timeRemaining === undefined
                                        ? 'N/A'
                                        : stakingDisplay.timeRemaining === Infinity
                                          ? '∞'
                                          : formatTimeRemaining(stakingDisplay.timeRemaining)}
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
                  <EmptyState>
                    Click on a tile to see analysis and details
                  </EmptyState>
                )}
              </AnalysisContent>
            )}
          </TabContent>

          {/* Action Buttons - Always visible at bottom */}
          <ActionSection style={{ display: 'flex', gap: '8px' }}>
            <PlayButton 
              href="https://github.com/djizus/ponziland-custom-map" 
              target="_blank" 
              rel="noopener noreferrer"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ 
                flex: 1,
                background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                padding: '8px 12px',
                fontSize: '12px'
              }}
            >
              📂 GitHub
            </PlayButton>
            <PlayButton 
              href="https://play.ponzi.land/game" 
              target="_blank" 
              rel="noopener noreferrer"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #15803d, #22c55e)',
                padding: '8px 12px',
                fontSize: '12px'
              }}
            >
              🎮 Ponziland
            </PlayButton>
          </ActionSection>
    </SidebarContainer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;

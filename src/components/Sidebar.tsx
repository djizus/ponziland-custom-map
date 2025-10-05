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
  isZeroAddress,
  convertStrkToReference,
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
  activeTab: 'map' | 'analysis' | 'settings' | 'prices';
  onTabChange: (tab: 'map' | 'analysis' | 'settings' | 'prices') => void;
  tabConfig: Array<{ key: 'map' | 'analysis' | 'settings' | 'prices'; label: string; title: string }>;
}) => (
  <TabNavigation>
    {tabConfig.map(tab => (
      <TabButton
        key={tab.key}
        onClick={() => onTabChange(tab.key)}
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
  activeTab: 'map' | 'analysis' | 'settings' | 'prices';
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
  onTabChange: (tab: 'map' | 'analysis' | 'settings' | 'prices') => void;
  onLayerChange: (layer: MapLayer) => void;
  onTokenChange: (token: string) => void;
  onStakeTokenChange: (token: string) => void;
  onShowNotOwnedChange: (show: boolean) => void;
  onDurationCapChange: (hours: number) => void;
  onPlayerSelectionChange: (address: string, isSelected: boolean) => void;
  referenceCurrency: string;
  referenceRate: number | null;
  onReferenceCurrencyChange: (currency: string) => void;
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
  onPlayerSelectionChange,
  referenceCurrency,
  referenceRate,
  onReferenceCurrencyChange,
}: SidebarProps) => {
  const normalizedReferenceCurrency = (referenceCurrency || BASE_TOKEN_SYMBOL).toUpperCase();

  const formatReferenceValue = useCallback((value: number, decimals = 2) => {
    const converted = convertStrkToReference(value, {
      referenceSymbol: normalizedReferenceCurrency,
      referenceRate,
    });

    if (!Number.isFinite(converted) || converted === 0) {
      return '0';
    }

    const abs = Math.abs(converted);
    const dynamicDecimals = abs >= 1
      ? decimals
      : Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1));

    return converted.toLocaleString('en-US', {
      minimumFractionDigits: dynamicDecimals,
      maximumFractionDigits: dynamicDecimals,
      useGrouping: false,
    });
  }, [normalizedReferenceCurrency, referenceRate]);

  const formatSignedReference = useCallback((value: number, decimals = 2) => {
    const converted = convertStrkToReference(value, {
      referenceSymbol: normalizedReferenceCurrency,
      referenceRate,
    });

    if (!Number.isFinite(converted) || converted === 0) {
      return '0';
    }

    const sign = converted > 0 ? '+' : '-';
    return `${sign}${formatReferenceValue(Math.abs(value), decimals)}`;
  }, [normalizedReferenceCurrency, referenceRate, formatReferenceValue]);

  const formatUsdValue = useCallback((value: number, decimals = 2) => {
    if (!Number.isFinite(value)) {
      return '$0.00';
    }

    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, []);

  const formatValueInToken = useCallback(
    (valueStrk: number, tokenAddress?: string, preferToken = false) => {
      const formattedReference = `${formatReferenceValue(valueStrk, 2)} ${normalizedReferenceCurrency}`;
      const normalizedAddress = normalizeTokenAddress(tokenAddress);
      const formatBaseAmount = (amount: number, decimals = 2) => {
        if (!Number.isFinite(amount) || amount === 0) {
          return '0';
        }

        const abs = Math.abs(amount);
        const dynamicDecimals = abs >= 1
          ? decimals
          : Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1));

        return amount.toLocaleString('en-US', {
          minimumFractionDigits: dynamicDecimals,
          maximumFractionDigits: dynamicDecimals,
          useGrouping: false,
        });
      };

      if (!Number.isFinite(valueStrk) || !normalizedAddress) {
        return formattedReference;
      }

      const token = prices.find(p => normalizeTokenAddress(p.address) === normalizedAddress);
      const baseAmountLabel = `${formatBaseAmount(valueStrk, 2)} ${BASE_TOKEN_SYMBOL}`;

      if (!token || token.symbol === BASE_TOKEN_SYMBOL || !token.ratio || token.ratio <= 0) {
        return preferToken ? baseAmountLabel : formattedReference;
      }

      const tokenAmount = valueStrk * token.ratio;
      const metadata = getTokenMetadata(token.address);
      const formattedToken = formatTokenAmount(tokenAmount, metadata?.decimals ?? 6);

      if (preferToken) {
        return `${formattedToken} ${token.symbol}`;
      }

      return `${formattedReference} (${formattedToken} ${token.symbol})`;
    },
    [prices, formatReferenceValue, normalizedReferenceCurrency],
  );

  const formatPerformanceDisplay = useCallback((land: { location: number; grossReturn: number; coords: string }) => {
    const signedValue = formatSignedReference(land.grossReturn, 1);
    return `${signedValue} | Land ${land.location} (${land.coords})`;
  }, [formatSignedReference]);

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
        amount: `${formatReferenceValue(0, 2)} ${normalizedReferenceCurrency}`,
        burnRate: `${formatReferenceValue(0, 2)} ${normalizedReferenceCurrency}/h`,
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
      ? `${formatReferenceValue(effectiveStrk, 2)} ${normalizedReferenceCurrency}`
      : tokenAmount > 0 && effectiveStrk > 0
        ? `${amountTokenStr} (${formatReferenceValue(effectiveStrk, 2)} ${normalizedReferenceCurrency})`
        : tokenAmount > 0
          ? amountTokenStr
          : `${formatReferenceValue(effectiveStrk, 2)} ${normalizedReferenceCurrency}`;

    const effectiveBurnStrk = burnRateStrk > 0
      ? burnRateStrk
      : (tokenIsStrk ? burnRateToken : 0);

    const formattedBurnEffective = formatReferenceValue(effectiveBurnStrk, 2);

    const burnRate = tokenIsStrk
      ? `${formattedBurnEffective} ${normalizedReferenceCurrency}/h`
      : burnRateToken > 0 && effectiveBurnStrk > 0
        ? `${burnTokenStr} (${formattedBurnEffective} ${normalizedReferenceCurrency})/h`
        : burnRateToken > 0
          ? `${burnTokenStr}/h`
          : `${formattedBurnEffective} ${normalizedReferenceCurrency}/h`;

    return {
      amount,
      burnRate,
      timeRemaining,
    };
  }, [selectedTileData, landTokenAddress, prices, formatReferenceValue, normalizedReferenceCurrency]);
  // Memoize tab configuration to avoid recreation
  const tabConfig = useMemo(() => [
    { key: 'map' as const, label: '🗺️', title: 'Map & Data' },
    { key: 'analysis' as const, label: '📊', title: 'Analysis & Details' },
    { key: 'prices' as const, label: '💹', title: 'Token Prices' },
    { key: 'settings' as const, label: '⚙️', title: 'Settings' }
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
  const usdcAvailable = useMemo(() => {
    const token = prices.find(p => (p.symbol || '').toUpperCase() === 'USDC');
    return !!(token?.ratio && token.ratio > 0);
  }, [prices]);

  const currencyOptions = useMemo(() => ([
    { symbol: 'STRK', disabled: false },
    { symbol: 'USDC', disabled: !usdcAvailable },
  ]), [usdcAvailable]);

  // Memoize player list with selection state
  const playerListItems = useMemo(() =>
    allPlayers.map(player => ({
      ...player,
      isSelected: selectedPlayerAddresses.has(player.address)
    }))
  , [allPlayers, selectedPlayerAddresses]);

  const tileOwnerDisplay = useMemo(() => {
    if (!selectedTileData) {
      return '';
    }

    if (selectedTileData.auction) {
      return 'AUCTION';
    }

    const land = selectedTileData.land;
    if (!land) {
      return 'Empty';
    }

    const owner = land.owner;
    if (!owner) {
      return 'Unowned';
    }

    if (isZeroAddress(owner)) {
      return 'Auctions';
    }

    const cacheKey = owner.toLowerCase();
    return usernameCache[cacheKey] || `${owner.slice(0, 4)}...${owner.slice(-3)}`;
  }, [selectedTileData, usernameCache]);

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

  const grossReturnForDisplay = useMemo(() => {
    if (!selectedTileData) {
      return 0;
    }

    if (selectedTileData.grossReturn !== undefined) {
      return selectedTileData.grossReturn;
    }

    if (selectedTileData.auction) {
      const basePrice = currentAuctionPrice ?? 0;
      const auctionTotalYield = selectedTileData.auctionYieldInfo?.totalYield ?? 0;
      return auctionTotalYield + basePrice;
    }

    const landPrice = selectedTileData.landPriceSTRK ?? 0;
    const totalYield = selectedTileData.yieldInfo?.totalYield ?? 0;
    return totalYield + landPrice;
  }, [selectedTileData, currentAuctionPrice]);

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
                        <InfoLabel>Yield / Hour:</InfoLabel>
                        <InfoValue>
                          {formatReferenceValue(playerStats.totalYieldPerHour, 2)} {normalizedReferenceCurrency}/h
                          {playerStats.totalYieldPerHourUSD !== null && normalizedReferenceCurrency === BASE_TOKEN_SYMBOL && (
                            <span style={{ marginLeft: '6px', color: '#bbb' }}>
                              (≈ {formatUsdValue(playerStats.totalYieldPerHourUSD, 2)}/h)
                            </span>
                          )}
                        </InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Portfolio Value:</InfoLabel>
                        <InfoValue>{formatReferenceValue(playerStats.totalPortfolioValue, 1)} {normalizedReferenceCurrency}</InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Staked Value:</InfoLabel>
                        <InfoValue>{formatReferenceValue(playerStats.totalStakedValue, 1)} {normalizedReferenceCurrency}</InfoValue>
                      </InfoLine>
                      <InfoLine style={{ marginBottom: '4px' }}>
                        <InfoLabel>Total Yield:</InfoLabel>
                        <InfoValue style={{ color: playerStats.totalYield > 0 ? '#4CAF50' : '#ff6b6b' }}>
                          {formatSignedReference(playerStats.totalYield, 1)} {normalizedReferenceCurrency}
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
                            {formatPerformanceDisplay(playerStats.bestPerformingLand)}
                          </InfoValue>
                        </InfoLine>
                      )}
                      {playerStats.worstPerformingLand && (
                        <InfoLine style={{ marginBottom: '4px' }}>
                          <InfoLabel>Worst Land:</InfoLabel>
                          <InfoValue style={{ color: '#ff6b6b' }}>
                            {formatPerformanceDisplay(playerStats.worstPerformingLand)}
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

              </ControlsSection>
            )}

            {activeTab === 'prices' && (
              <ControlsSection>
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

            {activeTab === 'settings' && (
              <ControlsSection>
                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>REFERENCE CURRENCY</h4>
                  <LayerSelector>
                    {currencyOptions.map(({ symbol: currency, disabled }) => (
                      <LayerOption
                        key={currency}
                        $isSelected={normalizedReferenceCurrency === currency}
                        style={disabled ? { opacity: 0.5 } : undefined}
                      >
                        <CompactCheckbox
                          type="radio"
                          name="reference-currency"
                          checked={normalizedReferenceCurrency === currency}
                          onChange={() => !disabled && onReferenceCurrencyChange(currency)}
                          disabled={disabled}
                        />
                        {currency}
                        {disabled && currency !== 'STRK' && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', color: '#bbb' }}>No price data</span>
                        )}
                      </LayerOption>
                    ))}
                  </LayerSelector>
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#888' }}>
                    Choose the currency used for price and yield displays. Settings persist per browser.
                  </p>
                </ControlGroup>

                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>MAX HOLDING DURATION</h4>
                  <DurationControls>
                    <InfoLabel style={{ display: 'block', marginBottom: '6px' }}>
                      Holding horizon: {durationCapHours} hours
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
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#888' }}>
                    Adjusts purchase recommendations, yields, and ROI calculations across the app.
                  </p>
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
                        {tileOwnerDisplay}
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
                                      <span style={{ color: '#4CAF50' }}>{formatReferenceValue(recommendation.maxYield, 1)} {normalizedReferenceCurrency}</span>
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
                                        {formatSignedReference(netProfit, 1)} {normalizedReferenceCurrency}
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
                                          {currentAuctionPrice !== undefined ? `${formatReferenceValue(currentAuctionPrice, 2)} ${normalizedReferenceCurrency}` : 'N/A'}
                                        </span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Gross Return:</span>
                                        <span style={{ color: grossReturnForDisplay > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {formatSignedReference(grossReturnForDisplay, 1)} {normalizedReferenceCurrency}
                                        </span>
                                      </InfoLine>
                                      <InfoLine>
                                        <span>Yield/Hour:</span>
                                        <span style={{ color: selectedTileData.auctionYieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b' }}>
                                          {formatSignedReference(selectedTileData.auctionYieldInfo.yieldPerHour, 1)} {normalizedReferenceCurrency}/h
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
                                      <span>{currentAuctionPrice !== undefined ? `${formatReferenceValue(currentAuctionPrice, 2)} ${normalizedReferenceCurrency}` : 'N/A'}</span>
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
                                        `${formatReferenceValue(selectedTileData.landPriceSTRK, 2)} ${normalizedReferenceCurrency}` : 
                                        'Not for sale'
                                      }
                                    </span>
                                  </InfoLine>
                                  <InfoLine>
                                    <span>Gross Return:</span>
                                    <span style={{ color: (selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceSTRK) > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                      {formatSignedReference(selectedTileData.yieldInfo.totalYield + selectedTileData.landPriceSTRK, 1)} {normalizedReferenceCurrency}
                                    </span>
                                  </InfoLine>
                                  <InfoLine>
                                    <span>Yield/Hour:</span>
                                    <span style={{ color: selectedTileData.yieldInfo.yieldPerHour > 0 ? '#4CAF50' : '#ff6b6b'}}>
                                      {formatSignedReference(selectedTileData.yieldInfo.yieldPerHour, 1)} {normalizedReferenceCurrency}/h
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

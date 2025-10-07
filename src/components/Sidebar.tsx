import { memo, useMemo, useCallback } from 'react';
import { SelectedTileDetails, TokenPrice, PonziLandConfig, MapLayer, GameEvent } from '../types/ponziland';
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
  formatStrkAmount,
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
  TabButton,
  EventList,
  EventItem,
  EventHeader,
  EventTitle,
  EventBadge,
  EventTimestamp,
  EventBody,
  EventMeta,
} from './PonzilandMap/styles';

// Simplified sidebar header - always visible
const SidebarHeaderComponent = memo(() => (
  <StyledSidebarHeader>
    <SidebarTitle>Ponziland Analysis</SidebarTitle>
  </StyledSidebarHeader>
));

const TabNavigationComponent = memo(({ activeTab, onTabChange, tabConfig }: {
  activeTab: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal';
  onTabChange: (tab: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal') => void;
  tabConfig: Array<{ key: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal'; label: string; title: string }>;
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
  activeTab: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal';
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
  eventLog: GameEvent[];
  eventHighlightHours: number;
  onEventSelect: (location: number) => void;
  onEventHighlightHoursChange: (hours: number) => void;
  onTabChange: (tab: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal') => void;
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
  eventLog,
  eventHighlightHours,
  onEventSelect,
  onEventHighlightHoursChange,
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

  const formatAbsoluteTimestamp = useCallback((value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '';
    }

    return new Date(value).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

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

  const formatTokenWithReference = useCallback(({
    strkValue,
    symbol,
    ratio,
    tokenDecimals,
    suffix = '',
    signed = false,
  }: {
    strkValue: number;
    symbol?: string;
    ratio?: number | null;
    tokenDecimals?: number;
    suffix?: string;
    signed?: boolean;
  }): string => {
    if (!Number.isFinite(strkValue)) {
      return `0 ${normalizedReferenceCurrency}${suffix}`;
    }

    const normalizedSymbol = (symbol || BASE_TOKEN_SYMBOL).toUpperCase();
    const effectiveRatio = normalizedSymbol === BASE_TOKEN_SYMBOL
      ? 1
      : (ratio && ratio > 0 ? ratio : null);

    const rawTokenAmount = effectiveRatio !== null ? strkValue * effectiveRatio : null;
    const decimalPlaces = tokenDecimals ?? 6;
    const needsPlusSign = signed && rawTokenAmount !== null && rawTokenAmount > 0;

    const formattedToken = rawTokenAmount !== null
      ? `${needsPlusSign ? '+' : ''}${formatTokenAmount(rawTokenAmount, decimalPlaces)} ${normalizedSymbol}${suffix}`
      : null;

    const referenceDisplay = signed
      ? `${formatSignedReference(strkValue, 2)} ${normalizedReferenceCurrency}${suffix}`
      : `${formatReferenceValue(strkValue, 2)} ${normalizedReferenceCurrency}${suffix}`;

    if (formattedToken) {
      return `${formattedToken} (${referenceDisplay})`;
    }

    return `${referenceDisplay}${normalizedSymbol !== normalizedReferenceCurrency ? ` · ${normalizedSymbol}` : ''}`;
  }, [formatReferenceValue, formatSignedReference, normalizedReferenceCurrency]);

  const formatPerformanceDisplay = useCallback((land: { location: number; grossReturn: number; coords: string }) => {
    const signedValue = formatSignedReference(land.grossReturn, 1);
    return `${signedValue} | Land ${land.location} (${land.coords})`;
  }, [formatSignedReference]);

  const shortenAddress = (address: string): string => {
    if (!address) {
      return '';
    }
    if (address.length <= 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const resolveOwnerDisplay = useCallback((address?: string): { label: string; address?: string } => {
    if (!address || !address.trim()) {
      return { label: 'Unowned' };
    }
    if (isZeroAddress(address)) {
      return { label: 'Unowned', address };
    }
    const normalized = address.toLowerCase();
    const alias = usernameCache[normalized];
    if (alias) {
      return { label: alias, address };
    }
    return { label: shortenAddress(address), address };
  }, [usernameCache]);

  const formatEventTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  const formatRelativeTime = useCallback((timestamp: number) => {
    const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (deltaSeconds < 60) {
      return `${deltaSeconds}s ago`;
    }
    const deltaMinutes = Math.floor(deltaSeconds / 60);
    if (deltaMinutes < 60) {
      return `${deltaMinutes}m ago`;
    }
    const deltaHours = Math.floor(deltaMinutes / 60);
    if (deltaHours < 24) {
      return `${deltaHours}h ago`;
    }
    const deltaDays = Math.floor(deltaHours / 24);
    return `${deltaDays}d ago`;
  }, []);

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

  const neighborDetails = useMemo(() => {
    const details = selectedTileData?.purchaseRecommendation?.neighborDetails;
    if (!details || details.length === 0) {
      return [];
    }

    return [...details].sort((a, b) => {
      const yieldA = Number.isFinite(a.hourlyYield) ? a.hourlyYield : 0;
      const yieldB = Number.isFinite(b.hourlyYield) ? b.hourlyYield : 0;
      return yieldB - yieldA;
    });
  }, [selectedTileData]);

  const incomeSummaries = useMemo(
    () => {
      if (neighborDetails.length === 0) {
        return [] as Array<{ symbol: string; strkPerHour: number; ratio: number | null; tokenDecimals: number }>;
      }

      const summaryMap = new Map<string, { symbol: string; strkPerHour: number; ratio: number | null; tokenDecimals: number }>();

      neighborDetails.forEach(neighbor => {
        const symbol = (neighbor.symbol || BASE_TOKEN_SYMBOL).toUpperCase();
        const strkPerHour = Number.isFinite(neighbor.hourlyYield) ? neighbor.hourlyYield : 0;
        const ratio = symbol === BASE_TOKEN_SYMBOL
          ? 1
          : (neighbor.ratio && neighbor.ratio > 0 ? neighbor.ratio : null);
        const tokenDecimals = neighbor.tokenDecimals ?? 6;

        const existing = summaryMap.get(symbol);
        if (existing) {
          existing.strkPerHour += strkPerHour;
        } else {
          summaryMap.set(symbol, { symbol, strkPerHour, ratio, tokenDecimals });
        }
      });

      return Array.from(summaryMap.values()).sort((a, b) => b.strkPerHour - a.strkPerHour);
    },
    [neighborDetails],
  );

  const outgoingSummary = useMemo(() => {
    if (!selectedTileData) {
      return null as null | { symbol: string; strkPerHour: number; ratio: number | null; tokenDecimals: number };
    }

    const strkPerHour = Number.isFinite(selectedTileData.taxInfo?.taxPaid)
      ? selectedTileData.taxInfo.taxPaid
      : 0;

    if (!strkPerHour || strkPerHour <= 0) {
      return null;
    }

    const symbol = (selectedTileData.symbol || BASE_TOKEN_SYMBOL).toUpperCase();
    const ratio = symbol === BASE_TOKEN_SYMBOL
      ? 1
      : (selectedTileData.ratio && selectedTileData.ratio > 0 ? selectedTileData.ratio : null);
    const tokenDecimals = selectedTileData.tokenDecimals ?? 6;

    return {
      symbol,
      strkPerHour,
      ratio,
      tokenDecimals,
    };
  }, [selectedTileData]);

  const netSummaries = useMemo(
    () => {
      if (incomeSummaries.length === 0 && !outgoingSummary) {
        return [] as Array<{ symbol: string; strkPerHour: number; ratio: number | null; tokenDecimals: number }>;
      }

      const summaryMap = new Map<string, { symbol: string; strkPerHour: number; ratio: number | null; tokenDecimals: number }>();

      incomeSummaries.forEach(item => {
        summaryMap.set(item.symbol, { ...item });
      });

      if (outgoingSummary) {
        const entry = summaryMap.get(outgoingSummary.symbol);
        if (entry) {
          entry.strkPerHour -= outgoingSummary.strkPerHour;
        } else {
          summaryMap.set(outgoingSummary.symbol, {
            symbol: outgoingSummary.symbol,
            strkPerHour: -outgoingSummary.strkPerHour,
            ratio: outgoingSummary.ratio,
            tokenDecimals: outgoingSummary.tokenDecimals,
          });
        }
      }

      return Array.from(summaryMap.values())
        .filter(item => Math.abs(item.strkPerHour) > 1e-6)
        .sort((a, b) => Math.abs(b.strkPerHour) - Math.abs(a.strkPerHour));
    },
    [incomeSummaries, outgoingSummary],
  );
  const hasSelectedPlayers = selectedPlayerAddresses.size > 0;

  const portfolioTimeline = useMemo(() => {
    const timeline = playerStats.pnlTimeline || [];
    if (timeline.length === 0) {
      return null as null | {
        points: Array<{ hour: number; netRef: number; cumulativeRef: number }>;
        path: string;
        zeroY: number;
        max: number;
        min: number;
      };
    }

    const points = timeline.map(point => ({
      hour: point.hour,
      netRef: convertStrkToReference(point.netStrk, {
        referenceSymbol: normalizedReferenceCurrency,
        referenceRate,
      }),
      cumulativeRef: convertStrkToReference(point.cumulativeStrk, {
        referenceSymbol: normalizedReferenceCurrency,
        referenceRate,
      }),
    }));

    const values = points.map(p => p.cumulativeRef);
    const maxVal = Math.max(...values, 0);
    const minVal = Math.min(...values, 0);
    const range = Math.abs(maxVal - minVal) < 1e-6 ? 1 : maxVal - minVal;
    const path = points.map((point, index) => {
      const x = timeline.length === 1 ? 0 : (index / (timeline.length - 1)) * 100;
      const y = ((maxVal - point.cumulativeRef) / range) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');

    const zeroY = ((maxVal - 0) / range) * 100;

    return {
      points,
      path,
      zeroY: Number.isFinite(zeroY) ? zeroY : 50,
      max: maxVal,
      min: minVal,
    };
  }, [playerStats.pnlTimeline, normalizedReferenceCurrency, referenceRate]);
  // Memoize tab configuration to avoid recreation
  const tabConfig = useMemo(() => [
    { key: 'map' as const, label: '🗺️', title: 'Map & Data' },
    { key: 'dashboard' as const, label: '📈', title: 'Portfolio Dashboard' },
    { key: 'analysis' as const, label: '📊', title: 'Analysis & Details' },
    { key: 'journal' as const, label: '📰', title: 'Recent Events' },
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

            {activeTab === 'dashboard' && (
              <AnalysisContent>
                {!hasSelectedPlayers ? (
                  <EmptyState>
                    Select at least one owner in the map tab to view portfolio stats.
                  </EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>
                        ESTIMATED P&amp;L (next {durationCapHours}h)
                      </h4>
                      <div
                        style={{
                          display: 'grid',
                          gap: '8px',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        }}
                      >
                        <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8affc1', letterSpacing: '0.05em' }}>
                            Income (total)
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#4CAF50' }}>
                            {formatReferenceValue(playerStats.totalIncomeStrk, 2)} {normalizedReferenceCurrency}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(248,113,113,0.08)', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#fca5a5', letterSpacing: '0.05em' }}>
                            Costs (total)
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#ff6b6b' }}>
                            {formatReferenceValue(playerStats.totalCostStrk, 2)} {normalizedReferenceCurrency}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#93c5fd', letterSpacing: '0.05em' }}>
                            Net (total)
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: playerStats.estimatedNetStrk >= 0 ? '#4CAF50' : '#ff6b6b'
                          }}>
                            {formatSignedReference(playerStats.estimatedNetStrk, 2)} {normalizedReferenceCurrency}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(245,158,11,0.09)', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#fbbf24', letterSpacing: '0.05em' }}>
                            Net / Hour
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: playerStats.totalYieldPerHour >= 0 ? '#4CAF50' : '#ff6b6b'
                          }}>
                            {formatSignedReference(playerStats.totalYieldPerHour, 2)} {normalizedReferenceCurrency}/h
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>Projected Cumulative P&amp;L</h4>
                      {portfolioTimeline && portfolioTimeline.path ? (
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '12px' }}>
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '140px' }}>
                            <line
                              x1="0"
                              x2="100"
                              y1={portfolioTimeline.zeroY.toFixed(2)}
                              y2={portfolioTimeline.zeroY.toFixed(2)}
                              stroke="rgba(255,255,255,0.1)"
                              strokeDasharray="2,3"
                            />
                            <path
                              d={portfolioTimeline.path}
                              fill="none"
                              stroke="url(#pnlGradient)"
                              strokeWidth="1.8"
                            />
                            <defs>
                              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" />
                                <stop offset="100%" stopColor="#4CAF50" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#bbb', marginTop: '6px' }}>
                            <span>
                              Start: {formatSignedReference(
                                playerStats.pnlTimeline.length > 0 ? playerStats.pnlTimeline[0].cumulativeStrk : 0,
                                2
                              )} {normalizedReferenceCurrency}
                            </span>
                            <span>
                              End ({portfolioTimeline.points.length}h): {formatSignedReference(
                                playerStats.pnlTimeline.length > 0
                                  ? playerStats.pnlTimeline[playerStats.pnlTimeline.length - 1].cumulativeStrk
                                  : 0,
                                2
                              )} {normalizedReferenceCurrency}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <InfoLine>
                          <span style={{ color: '#888' }}>
                            Not enough yield data to build a projection.
                          </span>
                        </InfoLine>
                      )}
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>Breakdown by Token</h4>
                      {playerStats.tokenBreakdown.length === 0 ? (
                        <InfoLine>
                          <span style={{ color: '#888' }}>
                            No active income sources detected for the selected owners.
                          </span>
                        </InfoLine>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {playerStats.tokenBreakdown.map(summary => {
                            const netStrk = summary.totalIncome - summary.totalCost;
                            return (
                              <div
                                key={summary.symbol}
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  borderRadius: '6px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, color: '#fff' }}>{summary.symbol}</span>
                                  <span style={{ color: netStrk >= 0 ? '#4CAF50' : '#ff6b6b', fontWeight: 600 }}>
                                    {formatTokenWithReference({
                                      strkValue: netStrk,
                                      symbol: summary.symbol,
                                      ratio: summary.ratio,
                                      tokenDecimals: summary.tokenDecimals,
                                      signed: true,
                                    })}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '6px',
                                  }}
                                >
                                  <div>
                                    <div style={{ fontSize: '10px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Income / h
                                    </div>
                                    <div>
                                      {formatTokenWithReference({
                                        strkValue: summary.hourlyIncome,
                                        symbol: summary.symbol,
                                        ratio: summary.ratio,
                                        tokenDecimals: summary.tokenDecimals,
                                        suffix: '/h',
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '10px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Costs / h
                                    </div>
                                    <div>
                                      {formatTokenWithReference({
                                        strkValue: summary.hourlyCost,
                                        symbol: summary.symbol,
                                        ratio: summary.ratio,
                                        tokenDecimals: summary.tokenDecimals,
                                        suffix: '/h',
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '10px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Income (total)
                                    </div>
                                    <div>
                                      {formatTokenWithReference({
                                        strkValue: summary.totalIncome,
                                        symbol: summary.symbol,
                                        ratio: summary.ratio,
                                        tokenDecimals: summary.tokenDecimals,
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '10px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Costs (total)
                                    </div>
                                    <div>
                                      {formatTokenWithReference({
                                        strkValue: summary.totalCost,
                                        symbol: summary.symbol,
                                        ratio: summary.ratio,
                                        tokenDecimals: summary.tokenDecimals,
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </AnalysisContent>
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

            {activeTab === 'journal' && (
              <ControlsSection>
                <ControlGroup>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ccc' }}>SURBRILLANCE RÉCENTE</h4>
                  <DurationControls>
                    <InfoLabel style={{ display: 'block', marginBottom: '6px' }}>
                      {eventHighlightHours === 1 ? 'Dernière heure' : `Dernières ${eventHighlightHours} heures`}
                    </InfoLabel>
                    <input
                      type="range"
                      min="1"
                      max="48"
                      step="1"
                      value={eventHighlightHours}
                      onChange={(e) => onEventHighlightHoursChange(Number(e.target.value))}
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
                      <span>1h</span>
                      <span>48h</span>
                    </DurationOptions>
                  </DurationControls>
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#888' }}>
                    Les terres modifiées durant cette période sont mises en surbrillance sur la carte et listées ci-dessous.
                  </p>
                </ControlGroup>

                {eventLog.length === 0 ? (
                  <EmptyState>
                    Aucun changement détecté sur cette période. Laissez la carte ouverte pour alimenter le journal.
                  </EmptyState>
                ) : (
                  <EventList>
                    {eventLog.map(event => {
                      const detectionLagMs = typeof event.detectedAt === 'number'
                        ? Math.max(0, event.detectedAt - event.timestamp)
                        : 0;
                      const idSegments = event.id.split('-');
                      const idTimestampRaw = idSegments.length >= 4 ? Number(idSegments[3]) : NaN;
                      const idTimestampLabel = Number.isFinite(idTimestampRaw)
                        ? formatAbsoluteTimestamp(idTimestampRaw)
                        : '';
                      const detectedTimestampLabel = formatAbsoluteTimestamp(event.detectedAt);
                      const relativeCapturedLabel = typeof event.detectedAt === 'number'
                        ? formatRelativeTime(event.detectedAt)
                        : '';
                      const badgeVariant = event.type === 'owner-change' ? 'owner' : 'auction';
                      const badgeLabel = event.type === 'owner-change'
                        ? 'Owner Change'
                        : event.type === 'auction-start'
                          ? 'Auction Start'
                          : 'Auction End';
                      const locationTitle = `Land ${event.location} (${event.coords})`;
                      let description = '';
                      let extraLine: string | null = null;
                      let priceDetails: string | null = null;

                      if (event.type === 'owner-change') {
                        const previousOwner = resolveOwnerDisplay(event.previousOwnerAddress);
                        const newOwner = resolveOwnerDisplay(event.newOwnerAddress);
                        if (event.previousOwnerAddress && event.newOwnerAddress) {
                          if (event.newOwnerAddress && isZeroAddress(event.newOwnerAddress)) {
                            description = `${previousOwner.label} released the land back to auction.`;
                          } else if (event.previousOwnerAddress && isZeroAddress(event.previousOwnerAddress)) {
                            description = `${newOwner.label} claimed the land from auction.`;
                          } else {
                            description = `${previousOwner.label} transferred ownership to ${newOwner.label}.`;
                          }
                          const prevShort = previousOwner.address ? shortenAddress(previousOwner.address) : previousOwner.label;
                          const newShort = newOwner.address ? shortenAddress(newOwner.address) : newOwner.label;
                          extraLine = `${prevShort} → ${newShort}`;
                        } else if (event.newOwnerAddress) {
                          const newOwner = resolveOwnerDisplay(event.newOwnerAddress);
                          if (isZeroAddress(event.newOwnerAddress)) {
                            description = 'Land ownership reset to the auction pool.';
                            extraLine = 'Unowned';
                          } else {
                            description = `${newOwner.label} claimed ownership.`;
                            extraLine = newOwner.address ? shortenAddress(newOwner.address) : newOwner.label;
                          }
                        } else if (event.previousOwnerAddress) {
                          const previousOwner = resolveOwnerDisplay(event.previousOwnerAddress);
                          if (isZeroAddress(event.previousOwnerAddress)) {
                            description = 'Auction listing cleared.';
                          } else {
                            description = `${previousOwner.label} no longer owns the land.`;
                          }
                          extraLine = previousOwner.address ? shortenAddress(previousOwner.address) : previousOwner.label;
                        } else {
                          description = 'Ownership status updated.';
                        }
                      } else if (event.type === 'auction-start') {
                        description = 'Auction started for this land.';
                        const startValue = event.auctionStartPriceSTRK;
                        const start = typeof startValue === 'number' && Number.isFinite(startValue)
                          ? `Start: ${formatStrkAmount(startValue, { decimals: 2, compact: false })} STRK`
                          : null;
                        const currentValue = event.auctionCurrentPriceSTRK;
                        const current = typeof currentValue === 'number' && Number.isFinite(currentValue)
                          ? `Now: ${formatStrkAmount(currentValue, { decimals: 2, compact: false })} STRK`
                          : null;
                        const floorValue = event.auctionFloorPriceSTRK;
                        const floor = typeof floorValue === 'number' && Number.isFinite(floorValue)
                          ? `Floor: ${formatStrkAmount(floorValue, { decimals: 2, compact: false })} STRK`
                          : null;
                        const parts = [start, current, floor].filter(Boolean) as string[];
                        priceDetails = parts.length > 0 ? parts.join(' · ') : null;
                      } else {
                        description = 'Auction ended for this land.';
                      }

                    return (
                      <EventItem
                        key={event.id}
                        onClick={() => onEventSelect(event.location)}
                        title={`Mettre en évidence la parcelle ${event.location}`}
                      >
                          <EventHeader>
                            <EventTitle>{locationTitle}</EventTitle>
                            <EventBadge $variant={badgeVariant}>{badgeLabel}</EventBadge>
                          </EventHeader>
                          <EventBody>
                            <div>{description}</div>
                          </EventBody>
                          {extraLine && (
                            <EventMeta>{extraLine}</EventMeta>
                          )}
                          {priceDetails && (
                            <EventMeta>{priceDetails}</EventMeta>
                          )}
                          {detectedTimestampLabel && (
                            <EventMeta>
                              Capté: {detectedTimestampLabel}
                            </EventMeta>
                          )}
                          {idTimestampLabel && idTimestampLabel !== detectedTimestampLabel && (
                            <EventMeta>
                              ID: {idTimestampLabel}
                            </EventMeta>
                          )}
                          {detectionLagMs > 60000 && relativeCapturedLabel && (
                            <EventMeta>{`Capté ${relativeCapturedLabel}`}</EventMeta>
                          )}
                          <EventTimestamp>
                            {formatEventTimestamp(event.timestamp)} · {formatRelativeTime(event.timestamp)}
                          </EventTimestamp>
                        </EventItem>
                      );
                    })}
                  </EventList>
                )}
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
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4CAF50' }}>Yield Analysis</div>
                                {selectedTileData.auctionYieldInfo ? (
                                  <>
                                    <InfoLine>
                                      <span>Price:</span>
                                      <span style={{ color: 'white' }}>
                                        {currentAuctionPrice !== undefined
                                          ? formatTokenWithReference({
                                              strkValue: currentAuctionPrice,
                                              symbol: selectedTileData.symbol,
                                              ratio: selectedTileData.symbol?.toUpperCase() === BASE_TOKEN_SYMBOL
                                                ? 1
                                                : selectedTileData.ratio,
                                              tokenDecimals: selectedTileData.tokenDecimals,
                                            })
                                          : 'N/A'}
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
                                        if (remaining <= 0) return 'Ended';
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
                            ) : (
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4CAF50' }}>Yield Analysis</div>
                                <InfoLine>
                                  <span>Price:</span>
                                  <span style={{ color: 'white' }}>
                                    {selectedTileData.land.sell_price
                                      ? formatTokenWithReference({
                                          strkValue: selectedTileData.landPriceSTRK,
                                          symbol: selectedTileData.symbol,
                                          ratio: selectedTileData.symbol?.toUpperCase() === BASE_TOKEN_SYMBOL
                                            ? 1
                                            : selectedTileData.ratio,
                                          tokenDecimals: selectedTileData.tokenDecimals,
                                        })
                                      : 'Not for sale'}
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
                            )}

                            <div>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#facc15' }}>Tax &amp; Income</div>

                              <div style={{ fontSize: '10px', color: '#bbb', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Incoming (per h)
                              </div>
                              {incomeSummaries.length > 0 ? incomeSummaries.map(summary => (
                                <InfoLine key={`income-${summary.symbol}`}>
                                  <span>{summary.symbol}:</span>
                                  <span style={{ color: summary.strkPerHour > 0 ? '#4CAF50' : '#888' }}>
                                    {formatTokenWithReference({
                                      strkValue: summary.strkPerHour,
                                      symbol: summary.symbol,
                                      ratio: summary.ratio,
                                      tokenDecimals: summary.tokenDecimals,
                                      suffix: '/h',
                                    })}
                                  </span>
                                </InfoLine>
                              )) : (
                                <InfoLine>
                                  <span>Yield:</span>
                                  <span style={{ color: '#888' }}>No active income</span>
                                </InfoLine>
                              )}

                              <div style={{ fontSize: '10px', color: '#bbb', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '6px' }}>
                                Outgoing (per h)
                              </div>
                              {outgoingSummary ? (
                                <InfoLine>
                                  <span>{outgoingSummary.symbol}:</span>
                                  <span style={{ color: '#ff6b6b' }}>
                                    {formatTokenWithReference({
                                      strkValue: outgoingSummary.strkPerHour,
                                      symbol: outgoingSummary.symbol,
                                      ratio: outgoingSummary.ratio,
                                      tokenDecimals: outgoingSummary.tokenDecimals,
                                      suffix: '/h',
                                    })}
                                  </span>
                                </InfoLine>
                              ) : (
                                <InfoLine>
                                  <span>Costs:</span>
                                  <span style={{ color: '#888' }}>No tax payments</span>
                                </InfoLine>
                              )}

                              <div style={{ fontSize: '10px', color: '#bbb', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '6px' }}>
                                Net (per h)
                              </div>
                              {netSummaries.length > 0 ? netSummaries.map(summary => {
                                const isPositive = summary.strkPerHour >= 0;
                                return (
                                  <InfoLine key={`net-${summary.symbol}`}>
                                    <span>{summary.symbol}:</span>
                                    <span style={{ color: isPositive ? '#4CAF50' : '#ff6b6b' }}>
                                      {formatTokenWithReference({
                                        strkValue: summary.strkPerHour,
                                        symbol: summary.symbol,
                                        ratio: summary.ratio,
                                        tokenDecimals: summary.tokenDecimals,
                                        suffix: '/h',
                                        signed: true,
                                      })}
                                    </span>
                                  </InfoLine>
                                );
                              }) : (
                                <InfoLine>
                                  <span>Net:</span>
                                  <span style={{ color: '#888' }}>0</span>
                                </InfoLine>
                              )}
                            </div>

                            {neighborDetails.length > 0 && (
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#f97316' }}>
                                  Neighbor Contributions ({selectedTileData.purchaseRecommendation?.neighborCount ?? neighborDetails.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: neighborDetails.length > 4 ? 'auto' : 'visible' }}>
          {neighborDetails.slice(0, 6).map((neighbor, index) => {
            const hourlyStrk = Number.isFinite(neighbor.hourlyYield) ? neighbor.hourlyYield : 0;
            const tokenSymbol = (neighbor.symbol || BASE_TOKEN_SYMBOL).toUpperCase();
            const tokenRatio = tokenSymbol === BASE_TOKEN_SYMBOL
              ? 1
              : (neighbor.ratio && neighbor.ratio > 0 ? neighbor.ratio : null);
            const tokenDecimals = neighbor.tokenDecimals ?? 6;
            const effectiveDuration = Math.min(
              durationCapHours,
              Number.isFinite(neighbor.timeRemaining) && neighbor.timeRemaining !== undefined
                ? neighbor.timeRemaining
                : durationCapHours
            );
            const totalYield = Number.isFinite(neighbor.totalYieldFromThisNeighbor)
              ? Number(neighbor.totalYieldFromThisNeighbor ?? 0)
              : hourlyStrk * effectiveDuration;
            return (
              <div
                key={`${neighbor.location}-${index}`}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <InfoLine>
                  <span style={{ color: '#fff' }}>
                    Land {neighbor.location} · {neighbor.symbol || BASE_TOKEN_SYMBOL}
                  </span>
                  <span style={{ color: '#4CAF50' }}>
                    {formatTokenWithReference({
                      strkValue: hourlyStrk,
                      symbol: tokenSymbol,
                      ratio: tokenRatio,
                      tokenDecimals,
                      suffix: '/h',
                    })}
                  </span>
                </InfoLine>
                <InfoLine>
                  <span>Time Remaining:</span>
                  <span>{formatTimeRemaining(neighbor.timeRemaining || 0)}</span>
                </InfoLine>
                <InfoLine>
                  <span>Total Potential:</span>
                  <span>
                    {formatTokenWithReference({
                      strkValue: totalYield,
                      symbol: tokenSymbol,
                      ratio: tokenRatio,
                      tokenDecimals,
                    })}
                  </span>
                </InfoLine>
              </div>
            );
          })}
                                </div>
                                {neighborDetails.length > 6 && (
                                  <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textAlign: 'right' }}>
                                    +{neighborDetails.length - 6} additional neighbors contributing
                                  </div>
                                )}
                              </div>
                            )}

                            {!selectedTileData.auction && (
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
                                  <span
                                    style={{
                                      color: selectedTileData.nukableStatus === 'nukable' ? '#ff6b6b' : (selectedTileData.nukableStatus === 'warning' ? 'orange' : '#4CAF50'),
                                      fontWeight: selectedTileData.nukableStatus !== false ? 'bold' : 'normal'
                                    }}
                                  >
                                    {stakingDisplay.timeRemaining === undefined
                                      ? 'N/A'
                                      : stakingDisplay.timeRemaining === Infinity
                                        ? '∞'
                                        : formatTimeRemaining(stakingDisplay.timeRemaining)}
                                  </span>
                                </InfoLine>
                              </div>
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

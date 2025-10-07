import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { SelectedTileDetails, MapLayer } from '../types/ponziland';

// Import custom hooks
import { useDataFetching } from '../hooks/useDataFetching';
import { useGameData } from '../hooks/useGameData';
import { usePlayerManagement } from '../hooks/usePlayerManagement';
import { usePersistence } from '../hooks/usePersistence';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useGameEvents } from '../hooks/useGameEvents';

// Import components
import Sidebar from './Sidebar';
import GridRenderer from './GridRenderer';
import ErrorBoundary from './ErrorBoundary';

// Import styled components
import { MapWrapper, GridWrapper } from './PonzilandMap/styles/MapStyles';

import { safeLocalStorage } from '../utils/errorHandler';
import { normalizeTokenAddress, BASE_TOKEN_SYMBOL } from '../utils/formatting';

// Move utility function outside component to avoid recreation
const loadPersistedState = <T,>(key: string, defaultValue: T): T => {
  return safeLocalStorage.parseJSON(key, defaultValue);
};

const PonzilandMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);

  const [zoom] = useState(1);

  // Use data fetching hook
  const { prices, landsSqlData, auctionsSqlData, stakesSqlData, configSqlData, loadingSql, errorSql } = useDataFetching();

  // Use game data processing hook
  const { gridData, activeAuctions, tokenInfoCache, neighborCache, activeTileLocations } = useGameData(
    landsSqlData,
    auctionsSqlData,
    stakesSqlData,
    prices,
    loadingSql,
    configSqlData
  );

  // Use player management hook
  const { usernameCache, allPlayers } = usePlayerManagement(gridData, loadingSql);

  // State management
  const [selectedPlayerAddresses, setSelectedPlayerAddresses] = useState<Set<string>>(
    () => new Set(loadPersistedState<string[]>('ponziland-selected-players', []))
  );
  
  // Sidebar is now always visible and non-collapsible
  
  const [activeTab, setActiveTab] = useState<'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal'>(() => {
    const persisted = loadPersistedState<'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal'>(
      'ponziland-active-tab',
      'map'
    );
    const validTabs: Array<'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal'> = [
      'map',
      'dashboard',
      'analysis',
      'settings',
      'prices',
      'journal',
    ];
    return validTabs.includes(persisted) ? persisted : 'map';
  });
  
  const [selectedTileData, setSelectedTileData] = useState<SelectedTileDetails | null>(null);
  
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>(
    () => loadPersistedState<MapLayer>('ponziland-selected-layer', 'purchasing')
  );
  
  const [selectedToken, setSelectedToken] = useState<string>(
    () => normalizeTokenAddress(loadPersistedState<string>('ponziland-selected-token', ''))
  );

  const [referenceCurrency, setReferenceCurrency] = useState<string>(() => {
    const persisted = loadPersistedState<string>('ponziland-reference-currency', BASE_TOKEN_SYMBOL);
    return (persisted || BASE_TOKEN_SYMBOL).toUpperCase();
  });

  // Auto-select STRK when tokens are loaded and no token is selected
  useEffect(() => {
    if (!selectedToken && prices.length > 0) {
      const STRKToken = prices.find(token => token.symbol === 'STRK');
      if (STRKToken) {
        setSelectedToken(normalizeTokenAddress(STRKToken.address));
      }
    }
  }, [selectedToken, prices]);
  
  const [durationCapHours, setDurationCapHours] = useState(
    () => {
      const persisted = loadPersistedState<number>('ponziland-duration-cap', 24);
      return Math.min(48, Math.max(2, persisted));
    }
  );

  const [selectedStakeToken, setSelectedStakeToken] = useState<string>(
    () => normalizeTokenAddress(loadPersistedState<string>('ponziland-stake-token', ''))
  );

  const [showNotOwned, setShowNotOwned] = useState<boolean>(
    () => loadPersistedState<boolean>('ponziland-show-not-owned', false)
  );

  const [eventHighlightHours, setEventHighlightHours] = useState<number>(() => {
    const persisted = loadPersistedState<number>('ponziland-event-highlight-hours', 6);
    return Math.min(48, Math.max(1, persisted || 6));
  });

  const [eventClock, setEventClock] = useState<number>(() => Date.now());
  const [focusedLocation, setFocusedLocation] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const interval = window.setInterval(() => {
      setEventClock(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const referenceRate = useMemo(() => {
    const target = referenceCurrency?.toUpperCase();
    if (!target || target === BASE_TOKEN_SYMBOL) {
      return 1;
    }

    const token = prices.find(p => (p.symbol || '').toUpperCase() === target);
    if (token?.ratio && token.ratio > 0) {
      return token.ratio;
    }

    return null;
  }, [referenceCurrency, prices]);

  const handleReferenceCurrencyChange = useCallback((currency: string) => {
    if (!currency) {
      setReferenceCurrency(BASE_TOKEN_SYMBOL);
      return;
    }

    setReferenceCurrency(currency.toUpperCase());
  }, []);

  useEffect(() => {
    if (referenceCurrency !== BASE_TOKEN_SYMBOL && (referenceRate === null || referenceRate === undefined)) {
      handleReferenceCurrencyChange(BASE_TOKEN_SYMBOL);
    }
  }, [referenceCurrency, referenceRate, handleReferenceCurrencyChange]);

  // Use player stats hook
  const playerStats = usePlayerStats(
    selectedPlayerAddresses,
    gridData,
    activeAuctions,
    tokenInfoCache,
    neighborCache,
    activeTileLocations,
    prices,
    durationCapHours,
    configSqlData
  );

  const gameEvents = useGameEvents(landsSqlData, auctionsSqlData, configSqlData);

  const recentEvents = useMemo(() => {
    if (!gameEvents.length || !eventHighlightHours) {
      return [];
    }

    const cutoff = eventClock - eventHighlightHours * 60 * 60 * 1000;
    return gameEvents.filter(event => {
      const detected = typeof event.detectedAt === 'number' ? event.detectedAt : event.timestamp;
      const effective = Math.max(event.timestamp, detected);
      return Number.isFinite(effective) && effective >= cutoff;
    });
  }, [gameEvents, eventHighlightHours, eventClock]);

  const recentChangeLocations = useMemo(() => {
    if (!recentEvents.length) {
      return new Set<number>();
    }
    return new Set(recentEvents.map(event => event.location));
  }, [recentEvents]);

  // Use persistence hook (sidebar always visible now)
  usePersistence(
    selectedPlayerAddresses,
    selectedLayer,
    selectedLayer === 'yield',
    false,
    activeTab,
    durationCapHours,
    selectedToken,
    selectedStakeToken,
    showNotOwned,
    referenceCurrency,
    eventHighlightHours,
  );

  // Event handlers
  const handleTileClick = useCallback((tileDetails: SelectedTileDetails) => {
    setSelectedTileData(tileDetails);
    setActiveTab('analysis');
  }, []);

  // Sidebar toggle removed since it's always visible

  const handleTabChange = useCallback((tab: 'map' | 'dashboard' | 'analysis' | 'settings' | 'prices' | 'journal') => {
    setActiveTab(tab);
  }, []);

  const handlePlayerSelectionChange = useCallback((address: string, isSelected: boolean) => {
    setSelectedPlayerAddresses(prevSelected => {
      const newSelected = new Set(prevSelected);
      const addrKey = address.toLowerCase();
      if (isSelected) {
        newSelected.add(addrKey);
      } else {
        newSelected.delete(addrKey);
      }
      return newSelected;
    });
  }, []);

  const handleDurationCapChange = useCallback((hours: number) => {
    const clamped = Math.min(48, Math.max(2, hours));
    setDurationCapHours(clamped);
  }, []);

  const handleEventHighlightHoursChange = useCallback((hours: number) => {
    const clamped = Math.min(48, Math.max(1, hours));
    setEventHighlightHours(clamped);
  }, []);

  const handleEventSelect = useCallback((location: number) => {
    setFocusedLocation(location);
  }, []);

  // Set document title
  useEffect(() => {
    document.title = "Ponziland ROI Map";
  }, []);


  // Loading and error states
  if (loadingSql) {
    return (
      <div style={{ color: 'white', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>
        Loading Ponziland Data...
      </div>
    );
  }
  
  if (errorSql && landsSqlData.length === 0) { 
    return (
      <div style={{ color: 'red', textAlign: 'center', paddingTop: '50px', fontSize: '20px' }}>
        Error loading data: {errorSql}
      </div>
    );
  }

  return (
    <MapWrapper ref={mapRef}>
      {/* Error Banner */}
      {errorSql && !loadingSql && landsSqlData.length > 0 && 
        <div style={{
          position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255, 0, 0, 0.7)', color: 'white', padding: '5px 10px', 
          borderRadius: '5px', zIndex: 2000, fontSize: '12px'
        }}>
          Update failed: {errorSql.length > 50 ? errorSql.substring(0,50)+"..." : errorSql} (showing previous data)
        </div>
      }
      
      {/* Sidebar */}
      <ErrorBoundary context="SIDEBAR">
        <Sidebar
        activeTab={activeTab}
        selectedLayer={selectedLayer}
        selectedToken={selectedToken}
        selectedStakeToken={selectedStakeToken}
        showNotOwned={showNotOwned}
        durationCapHours={durationCapHours}
        prices={prices}
        allPlayers={allPlayers}
        selectedPlayerAddresses={selectedPlayerAddresses}
        selectedTileData={selectedTileData}
        usernameCache={usernameCache}
        loadingSql={loadingSql}
        playerStats={playerStats}
        config={configSqlData}
        eventLog={recentEvents}
        eventHighlightHours={eventHighlightHours}
        onEventSelect={handleEventSelect}
        onEventHighlightHoursChange={handleEventHighlightHoursChange}
        onTabChange={handleTabChange}
        onLayerChange={setSelectedLayer}
        onTokenChange={setSelectedToken}
        onStakeTokenChange={setSelectedStakeToken}
        onShowNotOwnedChange={setShowNotOwned}
        onDurationCapChange={handleDurationCapChange}
        onPlayerSelectionChange={handlePlayerSelectionChange}
        referenceCurrency={referenceCurrency}
        referenceRate={referenceRate}
        onReferenceCurrencyChange={handleReferenceCurrencyChange}
        />
      </ErrorBoundary>

      {/* Grid Renderer */}
      <GridWrapper>
        <ErrorBoundary context="GRID_RENDERER">
          <GridRenderer
          gridData={gridData}
          activeAuctions={activeAuctions}
          tokenInfoCache={tokenInfoCache}
          neighborCache={neighborCache}
          activeTileLocations={activeTileLocations}
          selectedPlayerAddresses={selectedPlayerAddresses}
          focusedLocation={focusedLocation}
          recentChangeLocations={recentChangeLocations}
          selectedLayer={selectedLayer}
          selectedToken={selectedToken}
          showNotOwned={showNotOwned}
          hideNotRecommended={selectedLayer === 'yield'}
          durationCapHours={durationCapHours}
          zoom={zoom}
          config={configSqlData}
          onTileClick={handleTileClick}
          referenceCurrency={referenceCurrency}
          referenceRate={referenceRate}
          />
        </ErrorBoundary>
      </GridWrapper>

    </MapWrapper>
  );
};

export default PonzilandMap;

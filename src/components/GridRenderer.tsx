import { memo, useMemo } from 'react';
import {
  PonziLand,
  PonziLandAuction,
  PonziLandConfig,
  SelectedTileDetails,
  MapLayer,
} from '../types/ponziland';
import { GridContainer } from './PonzilandMap/styles/MapStyles';
import TileComponent from './TileComponent';
import { encodeCoordinates } from '../utils/dataProcessing';
import type { TokenInfo } from '../utils/formatting';

interface GridRendererProps {
  gridData: {
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
    activeLocations: number[];
  };
  activeAuctions: Record<number, PonziLandAuction>;
  tokenInfoCache: Map<string, TokenInfo>;
  neighborCache: Map<number, number[]>;
  activeTileLocations: Array<{ row: number; col: number; location: number }>;
  selectedPlayerAddresses: Set<string>;
  selectedLayer: MapLayer;
  focusedLocation: number | null;
  recentChangeLocations: Set<number>;
  selectedToken: string;
  showNotOwned: boolean;
  hideNotRecommended: boolean;
  durationCapHours: number;
  zoom: number;
  config: PonziLandConfig | null;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
  referenceCurrency: string;
  referenceRate: number | null;
}

interface InternalTileProps {
  row: number;
  col: number;
  gridRow: number;
  gridColumn: number;
  location: number;
  land: PonziLand | null;
  auction: PonziLandAuction | null;
  isHighlighted: boolean;
  isRecentlyChanged: boolean;
  isEventFocus: boolean;
  tokenInfoCache: Map<string, TokenInfo>;
  neighborCache: Map<number, number[]>;
  gridData: GridRendererProps['gridData'];
  activeAuctions: Record<number, PonziLandAuction>;
  selectedLayer: MapLayer;
  selectedToken: string;
  showNotOwned: boolean;
  hideNotRecommended: boolean;
  durationCapHours: number;
  config: PonziLandConfig | null;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
  referenceCurrency: string;
  referenceRate: number | null;
}

const TILE_SIZE = 100;

const GridRenderer = memo(({
  gridData,
  activeAuctions,
  tokenInfoCache,
  neighborCache,
  activeTileLocations,
  selectedPlayerAddresses,
  selectedLayer,
  focusedLocation,
  recentChangeLocations,
  selectedToken,
  showNotOwned,
  hideNotRecommended,
  durationCapHours,
  zoom,
  config: _config,
  onTileClick,
  referenceCurrency,
  referenceRate,
}: GridRendererProps) => {
  const { tileProps, gridWidth, gridHeight } = useMemo(() => {
    if (!activeTileLocations.length) {
      return { tileProps: [] as InternalTileProps[], gridWidth: 0, gridHeight: 0 };
    }

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    activeTileLocations.forEach(({ row, col }) => {
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    });

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    const items: InternalTileProps[] = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const location = encodeCoordinates(col, row);
        const land = gridData.tiles[location] ?? null;
        const auction = activeAuctions[location] ?? null;

        const isHighlighted = land?.owner
          ? selectedPlayerAddresses.has(land.owner.toLowerCase())
          : false;
        const isRecentlyChanged = recentChangeLocations.has(location);
        const isEventFocus = focusedLocation !== null && focusedLocation === location;

        items.push({
          row,
          col,
          gridRow: row - minRow + 1,
          gridColumn: col - minCol + 1,
          location,
          land,
          auction,
          isHighlighted,
          isRecentlyChanged,
          isEventFocus,
          tokenInfoCache,
          neighborCache,
          gridData,
          activeAuctions,
          selectedLayer,
          selectedToken,
          showNotOwned,
          hideNotRecommended,
          durationCapHours,
          config: _config,
          onTileClick,
          referenceCurrency,
          referenceRate,
        });
      }
    }

    return {
      tileProps: items,
      gridWidth: width,
      gridHeight: height,
    };
  }, [
    activeTileLocations,
    gridData.tiles,
    activeAuctions,
    selectedPlayerAddresses,
    selectedLayer,
    focusedLocation,
    recentChangeLocations,
    selectedToken,
    showNotOwned,
    hideNotRecommended,
    durationCapHours,
    tokenInfoCache,
    neighborCache,
    onTileClick,
    referenceCurrency,
    referenceRate,
  ]);

  return (
    <GridContainer
      zoom={zoom}
      style={{
        gridTemplateColumns: `repeat(${Math.max(gridWidth, 1)}, ${TILE_SIZE}px)`,
        gridTemplateRows: `repeat(${Math.max(gridHeight, 1)}, ${TILE_SIZE}px)`,
      }}
    >
      {tileProps.map(({ gridRow, gridColumn, ...props }) => (
        <div key={`${props.location}-${gridRow}-${gridColumn}`} style={{ gridRow, gridColumn }}>
          <TileComponent {...props} />
        </div>
      ))}
    </GridContainer>
  );
});

GridRenderer.displayName = 'GridRenderer';

export default GridRenderer;

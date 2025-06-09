import { memo, useMemo } from 'react';
import { PonziLand, PonziLandAuction, SelectedTileDetails, MapLayer } from '../types/ponziland';
import { GridContainer } from './PonzilandMap/styles/MapStyles';
import TileComponent from './TileComponent';

interface GridRendererProps {
  gridData: {
    tiles: (PonziLand | null)[];
    activeRows: number[];
    activeCols: number[];
  };
  activeAuctions: Record<number, PonziLandAuction>;
  tokenInfoCache: Map<string, { symbol: string; ratio: number | null }>;
  neighborCache: Map<number, number[]>;
  activeTileLocations: Array<{ row: number; col: number; location: number }>;
  selectedPlayerAddresses: Set<string>;
  selectedLayer: MapLayer;
  selectedToken: string;
  hideNotRecommended: boolean;
  durationCapHours: number;
  zoom: number;
  onTileClick: (tileDetails: SelectedTileDetails) => void;
}

const GridRenderer = memo(({
  gridData,
  activeAuctions,
  tokenInfoCache,
  neighborCache,
  activeTileLocations,
  selectedPlayerAddresses,
  selectedLayer,
  selectedToken,
  hideNotRecommended,
  durationCapHours,
  zoom,
  onTileClick
}: GridRendererProps) => {
  // Memoize tile props calculation to prevent unnecessary re-renders
  const tileProps = useMemo(() => {
    return activeTileLocations.map(({ row, col, location }) => {
      const land = gridData.tiles[location];
      const auction = activeAuctions[location];
      const isHighlighted = land?.owner ? selectedPlayerAddresses.has(land.owner.toLowerCase()) : false;
      
      return {
        row,
        col,
        location,
        land,
        auction,
        isHighlighted,
        tokenInfoCache,
        neighborCache,
        gridData,
        activeAuctions,
        selectedLayer,
        selectedToken,
        hideNotRecommended,
        durationCapHours,
        onTileClick
      };
    });
  }, [activeTileLocations, gridData.tiles, activeAuctions, selectedPlayerAddresses, tokenInfoCache, neighborCache, gridData, selectedLayer, selectedToken, hideNotRecommended, durationCapHours, onTileClick]);

  return (
    <GridContainer
      zoom={zoom}
      style={{
        gridTemplateColumns: `repeat(${gridData.activeCols.length}, 100px)`,
        gridTemplateRows: `repeat(${gridData.activeRows.length}, 100px)`,
        marginLeft: '0', // No margin needed since MapWrapper handles the spacing
        transition: 'margin-left 0.3s ease'
      }}
    >
      {tileProps.map((props) => (
        <TileComponent key={`${props.row}-${props.col}`} {...props} />
      ))}
    </GridContainer>
  );
});

GridRenderer.displayName = 'GridRenderer';

export default GridRenderer;
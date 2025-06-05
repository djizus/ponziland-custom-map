import styled from 'styled-components';

// General Panel Header for minimizable panels
export const PanelHeader = styled.div<{ $isMinimized: boolean }>`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: ${props => props.$isMinimized ? '0' : '10px'};
  color: #fff;
  text-align: center;
  border-bottom: ${props => props.$isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'};
  padding-bottom: ${props => props.$isMinimized ? '0' : '8px'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
`;

export const MinimizeButton = styled.span`
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
  &:hover {
    color: #7cb3ff;
  }
`;

export const PlayerListPanel = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  width: 220px; /* Reduced from 300px */
  max-height: 300px; // Max height before scrolling
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  ${props => props.$isMinimized && `
    width: auto; /* Shrink to content width when minimized */
    min-width: unset;
    padding: 10px;
    max-height: 50px; /* Height of header when minimized */
    cursor: pointer;
    
    .player-list-content {
      display: none;
    }
  `}
`;

export const PlayerListContent = styled.div`
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-right: 5px; // For scrollbar spacing

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px;
    border-radius: 3px;
    cursor: pointer;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
  input[type="checkbox"] {
    cursor: pointer;
  }
  .player-address {
    font-size: 10px;
    color: #aaa;
    margin-left: auto; /* Push address to the right */
  }
`;

export const ZoomControls = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  bottom: 60px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  ${props => props.$isMinimized && `
    .zoom-controls {
      display: none;
    }
    padding: 10px;
    width: auto;
  `}
`;

export const ZoomControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const ZoomButton = styled.button`
  background: #2a4b8d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  transition: all 0.2s;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #1e3a7b;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0px);
  }
`;

export const ZoomLevel = styled.div`
  color: white;
  padding: 4px 8px;
  font-size: 14px;
  min-width: 60px;
  text-align: center;
`;

export const PriceDisplay = styled.div<{ $isMinimized: boolean }>`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  width: 160px;
  transition: all 0.3s ease;
  
  ${props => props.$isMinimized && `
    width: auto;
    padding: 10px;
    cursor: pointer;
    
    ${PriceRow}, ${TokenValue} {
      display: none;
    }
  `}
`;

export const PriceRow = styled.div`
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
  gap: 4px;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 3px;
  }

  span:first-child {
    text-align: left;
    white-space: nowrap;
  }

  span:nth-child(2) {
    text-align: right;
  }

  span:nth-child(3) {
    text-align: left;
  }
`;

export const TokenSymbol = styled.span`
  color: #7cb3ff;
  font-weight: bold;
  min-width: 80px;
`;

export const TokenValue = styled.span`
  color: ${props => props.color || '#fff'};
  text-align: right;
`;

export const PriceHeader = styled.div<{ $isMinimized: boolean }>`
  font-size: 16px;
  font-weight: bold;
  margin-bottom: ${props => props.$isMinimized ? '0' : '10px'};
  color: #fff;
  text-align: center;
  border-bottom: ${props => props.$isMinimized ? 'none' : '2px solid rgba(255, 255, 255, 0.2)'};
  padding-bottom: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
`;

export const TileInfoPanelWrapper = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  padding: 10px;
  border-radius: 8px;
  color: white;
  z-index: 1001;
  width: 220px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 11px;
  text-align: left;

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #7cb3ff;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 8px;
    font-size: 15px;
  }

  h4 {
    font-size: 13px;
    color: #aacfff;
    margin-top: 0;
    margin-bottom: 6px;
    text-align: left;
  }

  p {
    margin: 6px 0;
    line-height: 1.4;
  }

  strong {
    color: #a0cfff;
  }

  .info-section {
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .info-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .close-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #999;
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
    padding: 3px;
  }
  .close-button:hover {
    color: white;
  }
`;

export const InfoLine = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px; /* Small gap between lines */

  span:first-child {
    font-weight: bold;
    color: #a0cfff; /* Label color */
    font-size: 10px;
  }
  span:last-child {
    text-align: right;
    font-size: 11px;
  }
`; 
import styled from 'styled-components';

export const MapWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
  background: #1a1a1a;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

export const GridContainer = styled.div<{ zoom: number }>`
  display: grid;
  gap: ${props => 2 * props.zoom}px;
  width: fit-content;
  margin: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transform: scale(${props => props.zoom});
  transform-origin: center top;
  transition: transform 0.2s ease;
`;

export const GameLink = styled.a`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: #2a4b8d;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;

  &:hover {
    background: #1e3a7b;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0px);
  }

  &:visited {
    color: white;
  }
`; 
import styled from 'styled-components';
import { PULSE_ANIMATION } from '../../../constants/ponziland';

export const Tile = styled.div<{
  $isMyLand: boolean;
  $isRecentChange: boolean;
  $isEventFocus: boolean;
  $level: number;
  $isEmpty: boolean;
  $valueColor: string;
  $isAuction: boolean;
  $isNukable: 'nukable' | 'warning' | false;
  $pulseGlowIntensity: number;
  $isRecommendedForPurchase: boolean;
  $isAnalysisLayer: boolean;
}>`
  ${PULSE_ANIMATION}
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: ${props => {
    if (props.$isEmpty) return '#1a1a1a';
    if (props.$isNukable === 'warning') return '#4d3015'; // Orange background for warning state
    if (props.$isAuction) return '#2d1a2d'; // Medium purple background for auctions
    return props.$valueColor;
  }};
  border: ${props => {
    if (props.$isMyLand) {
      return '3px solid gold';
    }
    if (props.$isEventFocus) {
      return '2px solid rgba(51, 201, 255, 0.9)';
    }
    // TODO: remettre en surbrillance les tuiles récemment modifiées une fois la palette validée
    // if (props.$isRecentChange) {
    //   return '2px solid rgba(51, 201, 255, 0.5)';
    // }
    if (props.$isAuction) {
      return '2px solid #4d2a4d'; // Medium purple border for auctions
    }
    if (props.$isAnalysisLayer && props.$isRecommendedForPurchase && !props.$isEmpty) {
      return '2px solid rgba(0, 255, 0, 0.8)'; // Green glowing border for recommended purchases
    }
    return '2px solid #333'; // Default border color
  }};
  box-shadow: ${props => {
    if (props.$isMyLand) {
      const base = '0 0 15px rgba(255, 215, 0, 0.5)';
      return props.$isEventFocus
        ? `${base}, 0 0 12px rgba(51, 201, 255, 0.5)`
        : base;
    }
    if (props.$isEventFocus) {
      return '0 0 12px rgba(51, 201, 255, 0.6), 0 0 20px rgba(51, 201, 255, 0.35)';
    }
    // TODO: remettre une animation spécifique pour les tuiles récentes
    if (props.$isAnalysisLayer && props.$isRecommendedForPurchase && !props.$isEmpty) {
      return '0 0 8px rgba(0, 255, 0, 0.6), 0 0 16px rgba(0, 255, 0, 0.3)'; // Green border glow for recommended purchases
    }
    return 'none';
  }};
  animation: none;
  color: white;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
    z-index: 1;
  }
`;

export const TileHeader = styled.div`
  font-weight: bold;
  color: #7cb3ff;
  font-size: 14px;
  margin-bottom: 4px;
  text-align: center;
`;

export const TileLocation = styled.div`
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

export const TileLevel = styled.div`
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

export const CompactTaxInfo = styled.div`
  font-size: 11px;
  color: #bbb;
  text-align: center;
  line-height: 1.2;
`;


export const StakedInfo = styled.div<{ $isNukable: 'nukable' | 'warning' | false }>`
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: ${props => {
    switch (props.$isNukable) {
      case 'nukable':
        return 'rgba(255, 0, 0, 0.5)';
      case 'warning':
        return 'rgba(255, 165, 0, 0.5)';
      default:
        return 'rgba(0, 0, 0, 0.5)';
    }
  }};
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: ${props => {
    switch (props.$isNukable) {
      case 'nukable':
        return '#ff9999';
      case 'warning':
        return '#ffd700';
      default:
        return '#fff';
    }
  }};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
`;

export const AuctionElapsedInfo = styled.div`
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
`;

/**
 * Sidebar-specific styled components to replace inline styles
 */

import styled from 'styled-components';
import { theme, mixins } from './theme';

// Main sidebar container - always visible
export const SidebarContainer = styled.div`
  position: sticky;
  top: 20px;
  width: 280px;
  height: calc(100vh - 40px);
  ${mixins.panelBase}
  ${mixins.flexColumn}
  overflow: hidden;
  flex-shrink: 0;
  align-self: flex-start;
`;

// Sidebar header with toggle button
export const SidebarHeader = styled.div`
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border.default};
  ${mixins.flexRow}
  justify-content: space-between;
  align-items: center;
  min-height: 50px;
`;

export const SidebarTitle = styled.span`
  font-weight: bold;
  font-size: ${theme.fontSize.xl};
  color: ${theme.colors.text.primary};
`;

// Tab navigation
export const TabNavigation = styled.div`
  ${mixins.flexRow}
  border-bottom: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.background.tabActive};
`;

export const TabContent = styled.div`
  flex: 1;
  padding: ${theme.spacing.md};
  overflow-y: auto;
  ${mixins.scrollbar}
`;

// Map controls section
export const ControlsSection = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.md};
`;

export const ControlGroup = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.sm};
`;

export const ControlRow = styled.div`
  ${mixins.flexRow}
  justify-content: space-between;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

// Layer selection
export const LayerSelector = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.xs};
`;

export const LayerOptions = styled.div`
  ${mixins.flexRow}
  gap: ${theme.spacing.sm};
  background: ${theme.colors.background.card};
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
`;

export const LayerOption = styled.label<{ $isSelected?: boolean }>`
  ${mixins.flexRow}
  gap: ${theme.spacing.xs};
  cursor: pointer;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.sm};
  transition: ${theme.transitions.normal};
  background: ${props => props.$isSelected ? theme.colors.primary : 'transparent'};
  color: ${props => props.$isSelected ? theme.colors.text.primary : theme.colors.text.secondary};
  
  &:hover {
    background: ${props => props.$isSelected ? theme.colors.primary : theme.colors.background.cardHover};
  }
`;

// Duration controls
export const DurationControls = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.sm};
`;

export const DurationOptions = styled.div`
  ${mixins.flexRow}
  justify-content: space-between;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

// Player list
export const PlayerList = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.xs};
  max-height: 180px;
  overflow-y: auto;
  ${mixins.scrollbar}
`;

export const PlayerItem = styled.label<{ $isSelected?: boolean }>`
  ${mixins.flexRow}
  gap: ${theme.spacing.sm};
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.sm};
  background: ${props => props.$isSelected ? theme.colors.background.selected : 'transparent'};
  transition: ${theme.transitions.normal};
  
  &:hover {
    background: ${props => props.$isSelected ? theme.colors.background.selected : theme.colors.background.cardHover};
  }
`;

export const PlayerName = styled.span<{ $isSelected?: boolean }>`
  color: ${props => props.$isSelected ? theme.colors.warningText : theme.colors.text.primary};
  ${mixins.textTruncate}
  flex: 1;
`;

export const PlayerCheckbox = styled.input`
  margin: 0;
  width: 12px;
  height: 12px;
  cursor: pointer;
`;

// Loading states
export const LoadingMessage = styled.div`
  text-align: center;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.muted};
  margin: ${theme.spacing.sm} 0;
`;

// Token prices section
export const TokenList = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.xs};
  max-height: 150px;
  overflow-y: auto;
  ${mixins.scrollbar}
`;

export const TokenItem = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  background: ${theme.colors.background.card};
  font-size: ${theme.fontSize.sm};
  font-family: monospace;
`;

export const TokenSymbol = styled.span`
  color: ${theme.colors.text.primary};
`;

export const TokenRatio = styled.span`
  color: ${theme.colors.success};
  text-align: center;
  padding: 0 ${theme.spacing.sm};
`;

export const TokenTarget = styled.span`
  color: ${theme.colors.text.primary};
`;

// Analysis tab content
export const AnalysisContent = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.md};
`;

export const SidebarTileHeader = styled.div`
  background: ${theme.colors.background.card};
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
`;

export const TileTitle = styled.div`
  font-weight: bold;
  margin-bottom: ${theme.spacing.xs};
  font-size: ${theme.fontSize.md};
  color: ${theme.colors.text.primary};
`;

export const TileSubtitle = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
`;

// Info sections
export const InfoSection = styled.div`
  margin-bottom: ${theme.spacing.sm};
  padding-bottom: ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.light};
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

export const InfoLine = styled.div`
  ${mixins.flexRow}
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.xs};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const InfoLabel = styled.span`
  font-weight: bold;
  color: ${theme.colors.text.accent};
  font-size: ${theme.fontSize.xs};
`;

export const InfoValue = styled.span<{ $color?: string }>`
  text-align: right;
  font-size: ${theme.fontSize.sm};
  color: ${props => props.$color || theme.colors.text.primary};
`;

// Empty states
export const EmptyState = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.muted};
  text-align: center;
  padding: ${theme.spacing.lg};
`;

// Action buttons section (bottom of sidebar)
export const ActionSection = styled.div`
  border-top: 1px solid ${theme.colors.border.default};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  ${mixins.flexCenter}
`;

export const PlayButton = styled.a`
  background: linear-gradient(135deg, ${theme.colors.success}, ${theme.colors.successHover});
  color: ${theme.colors.text.primary};
  text-decoration: none;
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.md};
  font-weight: bold;
  ${mixins.flexRow}
  gap: ${theme.spacing.sm};
  transition: all ${theme.transitions.normal};
  border: none;
  cursor: pointer;
  
  &:hover {
    background: linear-gradient(135deg, ${theme.colors.successHover}, ${theme.colors.successDark});
    transform: translateY(-1px);
    text-decoration: none;
    color: ${theme.colors.text.primary};
  }
  
  &:active {
    transform: translateY(0);
  }
`;

// Compact checkbox styling for small spaces
export const CompactCheckbox = styled.input`
  margin: 0;
  width: 12px;
  height: 12px;
  cursor: pointer;
  accent-color: ${theme.colors.primary};
`;
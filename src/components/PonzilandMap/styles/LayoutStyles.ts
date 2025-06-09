/**
 * Common layout styled components for consistent spacing and structure
 */

import styled from 'styled-components';
import { theme, mixins } from './theme';

// Flexible layout containers
export const FlexColumn = styled.div<{ $gap?: keyof typeof theme.spacing; $align?: string; $justify?: string }>`
  ${mixins.flexColumn}
  gap: ${props => props.$gap ? theme.spacing[props.$gap] : theme.spacing.md};
  align-items: ${props => props.$align || 'stretch'};
  justify-content: ${props => props.$justify || 'flex-start'};
`;

export const FlexRow = styled.div<{ $gap?: keyof typeof theme.spacing; $align?: string; $justify?: string; $wrap?: boolean }>`
  ${mixins.flexRow}
  gap: ${props => props.$gap ? theme.spacing[props.$gap] : theme.spacing.md};
  align-items: ${props => props.$align || 'center'};
  justify-content: ${props => props.$justify || 'flex-start'};
  flex-wrap: ${props => props.$wrap ? 'wrap' : 'nowrap'};
`;

export const FlexSpacer = styled.div`
  flex: 1;
`;

// Section containers
export const Section = styled.div<{ $padding?: keyof typeof theme.spacing }>`
  padding: ${props => props.$padding ? theme.spacing[props.$padding] : theme.spacing.md};
`;

export const SectionHeader = styled.div<{ $marginBottom?: keyof typeof theme.spacing }>`
  ${mixins.flexRow}
  justify-content: space-between;
  margin-bottom: ${props => props.$marginBottom ? theme.spacing[props.$marginBottom] : theme.spacing.sm};
`;

export const SectionTitle = styled.h4<{ $size?: keyof typeof theme.fontSize; $color?: string }>`
  margin: 0;
  font-size: ${props => props.$size ? theme.fontSize[props.$size] : theme.fontSize.md};
  color: ${props => props.$color || theme.colors.text.secondary};
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const SectionContent = styled.div<{ $maxHeight?: string; $scrollable?: boolean }>`
  ${props => props.$maxHeight ? `max-height: ${props.$maxHeight};` : ''}
  ${props => props.$scrollable ? `
    overflow-y: auto;
    ${mixins.scrollbar}
  ` : ''}
`;

// Dividers and separators
export const Divider = styled.div<{ $margin?: keyof typeof theme.spacing; $color?: string }>`
  height: 1px;
  background: ${props => props.$color || theme.colors.border.default};
  margin: ${props => props.$margin ? `${theme.spacing[props.$margin]} 0` : `${theme.spacing.md} 0`};
`;

export const VerticalDivider = styled.div<{ $height?: string; $color?: string }>`
  width: 1px;
  height: ${props => props.$height || '100%'};
  background: ${props => props.$color || theme.colors.border.default};
`;

// Grid layouts
export const Grid = styled.div<{ 
  $columns?: string; 
  $gap?: keyof typeof theme.spacing;
  $rowGap?: keyof typeof theme.spacing;
  $colGap?: keyof typeof theme.spacing;
}>`
  display: grid;
  grid-template-columns: ${props => props.$columns || '1fr'};
  gap: ${props => props.$gap ? theme.spacing[props.$gap] : theme.spacing.md};
  ${props => props.$rowGap ? `row-gap: ${theme.spacing[props.$rowGap]};` : ''}
  ${props => props.$colGap ? `column-gap: ${theme.spacing[props.$colGap]};` : ''}
`;

// Responsive containers
export const Container = styled.div<{ 
  $maxWidth?: string; 
  $padding?: keyof typeof theme.spacing;
  $center?: boolean;
}>`
  width: 100%;
  ${props => props.$maxWidth ? `max-width: ${props.$maxWidth};` : ''}
  ${props => props.$padding ? `padding: 0 ${theme.spacing[props.$padding]};` : ''}
  ${props => props.$center ? 'margin: 0 auto;' : ''}
`;

// Card-like containers
export const Card = styled.div<{ 
  $padding?: keyof typeof theme.spacing;
  $background?: string;
  $border?: boolean;
  $shadow?: boolean;
}>`
  background: ${props => props.$background || theme.colors.background.card};
  ${props => props.$border ? `border: 1px solid ${theme.colors.border.default};` : ''}
  border-radius: ${theme.borderRadius.lg};
  ${props => props.$padding ? `padding: ${theme.spacing[props.$padding]};` : `padding: ${theme.spacing.md};`}
  ${props => props.$shadow ? `box-shadow: ${theme.shadows.md};` : ''}
  
  &:hover {
    background: ${props => props.$background || theme.colors.background.cardHover};
  }
`;

// Position utilities
export const Absolute = styled.div<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
  $zIndex?: number;
}>`
  position: absolute;
  ${props => props.$top ? `top: ${props.$top};` : ''}
  ${props => props.$right ? `right: ${props.$right};` : ''}
  ${props => props.$bottom ? `bottom: ${props.$bottom};` : ''}
  ${props => props.$left ? `left: ${props.$left};` : ''}
  ${props => props.$zIndex ? `z-index: ${props.$zIndex};` : ''}
`;

export const Fixed = styled.div<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
  $zIndex?: number;
}>`
  position: fixed;
  ${props => props.$top ? `top: ${props.$top};` : ''}
  ${props => props.$right ? `right: ${props.$right};` : ''}
  ${props => props.$bottom ? `bottom: ${props.$bottom};` : ''}
  ${props => props.$left ? `left: ${props.$left};` : ''}
  ${props => props.$zIndex ? `z-index: ${props.$zIndex};` : ''}
`;

// Text utilities
export const TextTruncate = styled.div`
  ${mixins.textTruncate}
`;

export const TextCenter = styled.div`
  text-align: center;
`;

// Visibility utilities
export const Hidden = styled.div<{ $when?: boolean }>`
  ${props => props.$when ? 'display: none;' : ''}
`;

export const VisuallyHidden = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
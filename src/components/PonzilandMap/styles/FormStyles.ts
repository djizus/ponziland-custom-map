/**
 * Form controls and button styled components for consistent interactions
 */

import styled from 'styled-components';
import { theme, mixins } from './theme';

// Button variants
export const Button = styled.button<{
  $variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  $size?: 'sm' | 'md' | 'lg';
  $fullWidth?: boolean;
  $icon?: boolean;
}>`
  ${mixins.buttonBase}
  
  /* Size variants */
  ${props => {
    switch (props.$size) {
      case 'sm':
        return `
          padding: ${theme.spacing.xs} ${theme.spacing.sm};
          font-size: ${theme.fontSize.xs};
        `;
      case 'lg':
        return `
          padding: ${theme.spacing.md} ${theme.spacing.lg};
          font-size: ${theme.fontSize.lg};
        `;
      default:
        return `
          padding: ${theme.spacing.sm} ${theme.spacing.md};
          font-size: ${theme.fontSize.md};
        `;
    }
  }}
  
  /* Icon button */
  ${props => props.$icon ? `
    width: 40px;
    height: 40px;
    padding: ${theme.spacing.sm};
    display: flex;
    align-items: center;
    justify-content: center;
  ` : ''}
  
  /* Full width */
  ${props => props.$fullWidth ? 'width: 100%;' : ''}
  
  /* Variant styles */
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: ${theme.colors.button.primary};
          color: ${theme.colors.text.primary};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.button.primaryHover};
            transform: translateY(-1px);
          }
          
          &:active {
            transform: translateY(0);
          }
        `;
      case 'secondary':
        return `
          background: ${theme.colors.background.card};
          color: ${theme.colors.text.primary};
          border: 1px solid ${theme.colors.border.default};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.background.cardHover};
            border-color: ${theme.colors.border.medium};
          }
        `;
      case 'danger':
        return `
          background: ${theme.colors.button.danger};
          color: ${theme.colors.text.primary};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.button.dangerHover};
          }
        `;
      case 'ghost':
      default:
        return `
          background: ${theme.colors.button.transparent};
          color: ${theme.colors.text.primary};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.background.cardHover};
          }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
`;

// Tab button specific styling
export const TabButton = styled(Button)<{ $isActive?: boolean }>`
  border-radius: 0;
  border-bottom: 2px solid transparent;
  background: ${props => props.$isActive ? theme.colors.background.tabActive : 'transparent'};
  
  &:hover:not(:disabled) {
    background: ${props => props.$isActive ? theme.colors.background.tabActive : theme.colors.background.cardHover};
    transform: none;
  }
  
  ${props => props.$isActive ? `
    border-bottom-color: ${theme.colors.primary};
    color: ${theme.colors.primary};
  ` : ''}
`;

// Toggle button for sidebar collapse
export const ToggleButton = styled(Button)`
  ${mixins.buttonBase}
  background: transparent;
  color: ${theme.colors.text.primary};
  width: 32px;
  height: 32px;
  padding: ${theme.spacing.xs};
  
  &:hover:not(:disabled) {
    color: ${theme.colors.primary};
    background: ${theme.colors.background.cardHover};
  }
`;

// Input components
export const Input = styled.input<{
  $variant?: 'default' | 'range' | 'radio' | 'checkbox';
  $size?: 'sm' | 'md' | 'lg';
}>`
  ${mixins.inputBase}
  
  ${props => {
    switch (props.$variant) {
      case 'range':
        return `
          -webkit-appearance: none;
          background: transparent;
          border: none;
          width: 100%;
          height: 6px;
          
          &::-webkit-slider-track {
            background: ${theme.colors.border.default};
            border-radius: ${theme.borderRadius.sm};
            height: 6px;
          }
          
          &::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${theme.colors.primary};
            cursor: pointer;
            border: 2px solid ${theme.colors.text.primary};
          }
          
          &::-moz-range-track {
            background: ${theme.colors.border.default};
            border-radius: ${theme.borderRadius.sm};
            height: 6px;
            border: none;
          }
          
          &::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${theme.colors.primary};
            cursor: pointer;
            border: 2px solid ${theme.colors.text.primary};
          }
        `;
      case 'radio':
        return `
          width: 16px;
          height: 16px;
          border-radius: 50%;
          margin: 0;
          cursor: pointer;
          
          &:checked {
            background: ${theme.colors.primary};
            border-color: ${theme.colors.primary};
          }
        `;
      case 'checkbox':
        return `
          width: 16px;
          height: 16px;
          margin: 0;
          cursor: pointer;
          
          &:checked {
            background: ${theme.colors.primary};
            border-color: ${theme.colors.primary};
          }
        `;
      default:
        return `
          padding: ${theme.spacing.sm};
          font-size: ${theme.fontSize.md};
        `;
    }
  }}
`;

// Label components
export const Label = styled.label<{
  $size?: keyof typeof theme.fontSize;
  $color?: string;
  $weight?: 'normal' | 'bold';
  $clickable?: boolean;
}>`
  font-size: ${props => props.$size ? theme.fontSize[props.$size] : theme.fontSize.md};
  color: ${props => props.$color || theme.colors.text.primary};
  font-weight: ${props => props.$weight || 'normal'};
  ${props => props.$clickable ? 'cursor: pointer;' : ''}
  line-height: 1.4;
  
  ${props => props.$clickable ? `
    &:hover {
      color: ${theme.colors.primary};
    }
  ` : ''}
`;

// Form group for organizing form elements
export const FormGroup = styled.div<{
  $direction?: 'row' | 'column';
  $gap?: keyof typeof theme.spacing;
  $align?: string;
}>`
  display: flex;
  flex-direction: ${props => props.$direction || 'column'};
  gap: ${props => props.$gap ? theme.spacing[props.$gap] : theme.spacing.sm};
  align-items: ${props => props.$align || 'stretch'};
`;

// Radio/checkbox group
export const RadioGroup = styled(FormGroup)`
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

export const RadioOption = styled(Label)`
  ${mixins.flexRow}
  gap: ${theme.spacing.sm};
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  transition: ${theme.transitions.normal};
  
  &:hover {
    background: ${theme.colors.background.cardHover};
  }
`;

// Select/dropdown (if needed)
export const Select = styled.select`
  ${mixins.inputBase}
  padding: ${theme.spacing.sm};
  font-size: ${theme.fontSize.md};
  cursor: pointer;
  
  option {
    background: ${theme.colors.background.panelDark};
    color: ${theme.colors.text.primary};
  }
`;

// Switch component
export const Switch = styled.div<{ $checked?: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  background: ${props => props.$checked ? theme.colors.primary : theme.colors.border.default};
  border-radius: 12px;
  cursor: pointer;
  transition: ${theme.transitions.normal};
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.$checked ? '22px' : '2px'};
    width: 20px;
    height: 20px;
    background: ${theme.colors.text.primary};
    border-radius: 50%;
    transition: ${theme.transitions.normal};
  }
`;

// Field with label
export const Field = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.xs};
`;

export const FieldLabel = styled(Label)`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
  font-weight: bold;
`;

export const FieldError = styled.div`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.error};
  margin-top: ${theme.spacing.xs};
`;

// Range input with labels
export const RangeContainer = styled.div`
  ${mixins.flexColumn}
  gap: ${theme.spacing.xs};
`;

export const RangeLabels = styled.div`
  ${mixins.flexRow}
  justify-content: space-between;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;
/**
 * State display styled components for loading, error, and empty states
 */

import styled, { keyframes } from 'styled-components';
import { theme, mixins } from './theme';

// Loading animations
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Loading components
export const LoadingContainer = styled.div<{ $fullScreen?: boolean; $center?: boolean }>`
  ${props => props.$fullScreen ? `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${theme.colors.background.overlay};
    z-index: ${theme.zIndex.modal};
  ` : ''}
  
  ${props => props.$center ? mixins.flexCenter : mixins.flexColumn}
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.lg};
`;

export const LoadingSpinner = styled.div<{ $size?: 'sm' | 'md' | 'lg'; $color?: string }>`
  ${props => {
    const size = props.$size === 'sm' ? '16px' : props.$size === 'lg' ? '48px' : '32px';
    return `
      width: ${size};
      height: ${size};
    `;
  }}
  
  border: 2px solid ${theme.colors.border.default};
  border-top: 2px solid ${props => props.$color || theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

export const LoadingText = styled.div<{ $size?: keyof typeof theme.fontSize }>`
  font-size: ${props => props.$size ? theme.fontSize[props.$size] : theme.fontSize.md};
  color: ${theme.colors.text.secondary};
  text-align: center;
  animation: ${pulse} 2s ease-in-out infinite;
`;

export const LoadingDots = styled.div`
  ${mixins.flexRow}
  gap: ${theme.spacing.xs};
  
  &::after {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${theme.colors.primary};
    animation: ${pulse} 1.5s ease-in-out infinite;
  }
  
  &::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${theme.colors.primary};
    animation: ${pulse} 1.5s ease-in-out infinite 0.5s;
  }
`;

// Error components
export const ErrorContainer = styled.div<{ $variant?: 'banner' | 'card' | 'inline' }>`
  ${props => {
    switch (props.$variant) {
      case 'banner':
        return `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          min-width: 300px;
          max-width: 600px;
          z-index: ${theme.zIndex.notification};
        `;
      case 'card':
        return `
          border: 1px solid ${theme.colors.error};
          border-radius: ${theme.borderRadius.lg};
          box-shadow: ${theme.shadows.md};
        `;
      case 'inline':
      default:
        return '';
    }
  }}
  
  background: ${theme.colors.background.panelDark};
  color: ${theme.colors.error};
  padding: ${theme.spacing.md};
  animation: ${fadeIn} 0.3s ease-out;
`;

export const ErrorIcon = styled.div`
  font-size: ${theme.fontSize.lg};
  margin-right: ${theme.spacing.sm};
  color: ${theme.colors.error};
`;

export const ErrorTitle = styled.div`
  font-weight: bold;
  font-size: ${theme.fontSize.lg};
  margin-bottom: ${theme.spacing.xs};
  color: ${theme.colors.error};
`;

export const ErrorMessage = styled.div`
  font-size: ${theme.fontSize.md};
  color: ${theme.colors.text.secondary};
  line-height: 1.4;
`;

export const ErrorDetails = styled.details`
  margin-top: ${theme.spacing.sm};
  
  summary {
    cursor: pointer;
    font-size: ${theme.fontSize.sm};
    color: ${theme.colors.text.muted};
    margin-bottom: ${theme.spacing.xs};
    
    &:hover {
      color: ${theme.colors.text.secondary};
    }
  }
`;

export const ErrorStack = styled.pre`
  font-size: ${theme.fontSize.xs};
  overflow: auto;
  background: ${theme.colors.background.card};
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.text.muted};
  white-space: pre-wrap;
  max-height: 200px;
  ${mixins.scrollbar}
`;

export const ErrorActions = styled.div`
  ${mixins.flexRow}
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.md};
  justify-content: flex-end;
`;

// Success/info components
export const SuccessContainer = styled(ErrorContainer)`
  color: ${theme.colors.success};
  border-color: ${theme.colors.success};
`;

export const InfoContainer = styled(ErrorContainer)`
  color: ${theme.colors.primary};
  border-color: ${theme.colors.primary};
`;

export const WarningContainer = styled(ErrorContainer)`
  color: ${theme.colors.warning};
  border-color: ${theme.colors.warning};
`;

// Empty state components
export const EmptyStateContainer = styled.div<{ $center?: boolean }>`
  ${props => props.$center ? mixins.flexCenter : mixins.flexColumn}
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.xl};
  text-align: center;
  color: ${theme.colors.text.muted};
`;

export const EmptyStateIcon = styled.div`
  font-size: 48px;
  opacity: 0.5;
  margin-bottom: ${theme.spacing.sm};
`;

export const EmptyStateTitle = styled.div`
  font-size: ${theme.fontSize.lg};
  font-weight: bold;
  color: ${theme.colors.text.secondary};
  margin-bottom: ${theme.spacing.xs};
`;

export const EmptyStateMessage = styled.div`
  font-size: ${theme.fontSize.md};
  color: ${theme.colors.text.muted};
  line-height: 1.4;
  max-width: 400px;
`;

export const EmptyStateAction = styled.div`
  margin-top: ${theme.spacing.md};
`;

// Progress indicators
export const ProgressBar = styled.div<{ $progress?: number }>`
  width: 100%;
  height: 4px;
  background: ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.sm};
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$progress || 0}%;
    background: ${theme.colors.primary};
    border-radius: ${theme.borderRadius.sm};
    transition: width 0.3s ease;
  }
`;

export const ProgressText = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
  margin-top: ${theme.spacing.xs};
  text-align: center;
`;

// Status badges
export const StatusBadge = styled.span<{ 
  $variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  $size?: 'sm' | 'md';
}>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${props => props.$size === 'sm' ? 
    `${theme.spacing.xs} ${theme.spacing.sm}` : 
    `${theme.spacing.sm} ${theme.spacing.md}`
  };
  border-radius: ${theme.borderRadius.md};
  font-size: ${props => props.$size === 'sm' ? theme.fontSize.xs : theme.fontSize.sm};
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => {
    switch (props.$variant) {
      case 'success':
        return `
          background: rgba(76, 175, 80, 0.2);
          color: ${theme.colors.success};
          border: 1px solid ${theme.colors.success};
        `;
      case 'error':
        return `
          background: rgba(255, 107, 107, 0.2);
          color: ${theme.colors.error};
          border: 1px solid ${theme.colors.error};
        `;
      case 'warning':
        return `
          background: rgba(255, 215, 0, 0.2);
          color: ${theme.colors.warning};
          border: 1px solid ${theme.colors.warning};
        `;
      case 'info':
        return `
          background: rgba(124, 179, 255, 0.2);
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary};
        `;
      case 'neutral':
      default:
        return `
          background: ${theme.colors.background.card};
          color: ${theme.colors.text.secondary};
          border: 1px solid ${theme.colors.border.default};
        `;
    }
  }}
`;

// Skeleton loading
export const Skeleton = styled.div<{ $width?: string; $height?: string; $rounded?: boolean }>`
  width: ${props => props.$width || '100%'};
  height: ${props => props.$height || '20px'};
  background: linear-gradient(
    90deg,
    ${theme.colors.background.card} 25%,
    ${theme.colors.background.cardHover} 50%,
    ${theme.colors.background.card} 75%
  );
  background-size: 200% 100%;
  border-radius: ${props => props.$rounded ? '50%' : theme.borderRadius.md};
  animation: ${pulse} 2s ease-in-out infinite;
`;

// Toast notifications (if needed)
export const ToastContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: ${theme.zIndex.notification};
  max-width: 400px;
`;

export const Toast = styled.div<{ $variant?: 'success' | 'error' | 'warning' | 'info' }>`
  ${mixins.panelBase}
  margin-bottom: ${theme.spacing.sm};
  animation: ${fadeIn} 0.3s ease-out;
  
  ${props => {
    switch (props.$variant) {
      case 'success':
        return `border-left: 4px solid ${theme.colors.success};`;
      case 'error':
        return `border-left: 4px solid ${theme.colors.error};`;
      case 'warning':
        return `border-left: 4px solid ${theme.colors.warning};`;
      case 'info':
        return `border-left: 4px solid ${theme.colors.primary};`;
      default:
        return '';
    }
  }}
`;
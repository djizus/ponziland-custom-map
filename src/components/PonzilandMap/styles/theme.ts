/**
 * Centralized theme system for consistent styling across the application
 */

export const theme = {
  colors: {
    // Primary brand colors
    primary: '#7cb3ff',
    accent: '#aacfff',
    
    // State colors
    success: '#4CAF50',
    successHover: '#45a049',
    successDark: '#3d8b40',
    error: '#ff6b6b',
    warning: '#ffd700',
    warningText: '#FFD700',
    
    // Backgrounds
    background: {
      dark: '#1a1a1a',
      panel: 'rgba(0, 0, 0, 0.7)',
      panelDark: 'rgba(0, 0, 0, 0.85)',
      overlay: 'rgba(0, 0, 0, 0.95)',
      card: 'rgba(255, 255, 255, 0.05)',
      cardHover: 'rgba(255, 255, 255, 0.1)',
      selected: 'rgba(255, 215, 0, 0.1)',
      tabActive: 'rgba(0, 0, 0, 0.2)'
    },
    
    // Text colors
    text: {
      primary: '#fff',
      secondary: '#ccc',
      muted: '#888',
      accent: '#a0cfff',
      label: '#aacfff'
    },
    
    // Border colors
    border: {
      default: 'rgba(255, 255, 255, 0.1)',
      light: 'rgba(255, 255, 255, 0.05)',
      medium: 'rgba(255, 255, 255, 0.15)',
      heavy: 'rgba(255, 255, 255, 0.2)'
    },
    
    // Button colors
    button: {
      primary: '#2a4b8d',
      primaryHover: '#1e3a7b',
      transparent: 'transparent',
      danger: '#ff6b6b',
      dangerHover: '#ff5252'
    }
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '20px',
    xl: '24px',
    xxl: '32px'
  },
  
  fontSize: {
    xs: '10px',
    sm: '11px',
    md: '12px',
    lg: '13px',
    xl: '14px',
    xxl: '15px',
    h1: '20px',
    h2: '18px',
    h3: '16px',
    h4: '14px'
  },
  
  borderRadius: {
    sm: '3px',
    md: '4px',
    lg: '6px',
    xl: '8px'
  },
  
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.2)',
    md: '0 2px 8px rgba(0, 0, 0, 0.3)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.4)'
  },
  
  transitions: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease'
  },
  
  zIndex: {
    base: 1,
    overlay: 1000,
    modal: 1001,
    tooltip: 1002,
    notification: 1003
  }
} as const;

// Type for theme usage
export type Theme = typeof theme;

// Helper functions for common theme usage
export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = theme.colors;
  
  for (const key of keys) {
    value = value?.[key];
  }
  
  return value || path;
};

export const getSpacing = (size: keyof typeof theme.spacing): string => {
  return theme.spacing[size];
};

export const getFontSize = (size: keyof typeof theme.fontSize): string => {
  return theme.fontSize[size];
};

// Common style mixins
export const mixins = {
  flexCenter: `
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  
  flexColumn: `
    display: flex;
    flex-direction: column;
  `,
  
  flexRow: `
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  
  panelBase: `
    background: ${theme.colors.background.panel};
    border: 1px solid ${theme.colors.border.default};
    border-radius: ${theme.borderRadius.xl};
    color: ${theme.colors.text.primary};
    box-shadow: ${theme.shadows.md};
  `,
  
  buttonBase: `
    border: none;
    border-radius: ${theme.borderRadius.md};
    cursor: pointer;
    font-size: ${theme.fontSize.md};
    transition: ${theme.transitions.normal};
    outline: none;
    
    &:focus {
      outline: 2px solid ${theme.colors.primary};
      outline-offset: 2px;
    }
  `,
  
  inputBase: `
    border: 1px solid ${theme.colors.border.default};
    border-radius: ${theme.borderRadius.md};
    background: ${theme.colors.background.card};
    color: ${theme.colors.text.primary};
    transition: ${theme.transitions.normal};
    
    &:focus {
      border-color: ${theme.colors.primary};
      outline: none;
    }
  `,
  
  textTruncate: `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  
  scrollbar: `
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${theme.colors.background.card};
      border-radius: ${theme.borderRadius.sm};
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${theme.colors.border.medium};
      border-radius: ${theme.borderRadius.sm};
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: ${theme.colors.border.heavy};
    }
  `
};
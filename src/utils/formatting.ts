import { TokenPrice } from '../types/ponziland';
import { logError } from './errorHandler';

export const formatRatio = (ratio: number | null): string => {
  try {
    if (ratio === null || ratio === undefined) {
      return 'N/A';
    }
    
    if (typeof ratio !== 'number' || !isFinite(ratio)) {
      logError('FORMAT_RATIO', new Error('Invalid ratio value'), {
        component: 'formatting',
        metadata: { ratio, type: typeof ratio }
      });
      return 'N/A';
    }
    
    if (ratio >= 1) {
      return ratio.toFixed(2);
    }
    
    if (ratio <= 0) {
      return '0.00';
    }
    
    // For small numbers, calculate appropriate decimal places
    const decimalPlaces = Math.max(2, -Math.floor(Math.log10(ratio)) + 2);
    return ratio.toFixed(decimalPlaces);
  } catch (error) {
    logError('FORMAT_RATIO', error, {
      component: 'formatting',
      metadata: { ratio }
    });
    return 'N/A';
  }
};

export const getTokenInfo = (address: string, prices: TokenPrice[]): { symbol: string; ratio: number | null } => {
  if (!address) return { symbol: 'Unknown', ratio: null };
  const addrKey = address.toLowerCase();
  const tokenInfo = prices.find(p => p.address.toLowerCase() === addrKey);
  return {
    symbol: tokenInfo?.symbol || 'Unknown',
    ratio: tokenInfo?.ratio || null
  };
};

// Performance optimized version using cache
export const getTokenInfoCached = (address: string, tokenCache: Map<string, { symbol: string; ratio: number | null }>): { symbol: string; ratio: number | null } => {
  const addrKey = address.toLowerCase();
  return tokenCache.get(addrKey) || { symbol: 'Unknown', ratio: null };
};

export const formatOriginalPrice = (price: string | null): string => {
  if (!price) return 'Not for sale';
  const bigIntPrice = BigInt(price);
  const divisor = BigInt('1000000000000000000'); // 18 decimals
  const wholePart = bigIntPrice / divisor;
  const fractionalPart = bigIntPrice % divisor;
  const formattedFractional = fractionalPart.toString().padStart(18, '0').slice(0, 2);
  return `${wholePart}${formattedFractional ? `.${formattedFractional}` : ''}`;
};

export const calculateESTRKPrice = (originalPrice: string | null, ratio: number | null): string => {
  if (!originalPrice || ratio === null || ratio === undefined) return '';
  const price = Number(formatOriginalPrice(originalPrice));
  return (price / ratio).toFixed(2);
};

export const formatCoordinate = (num: number | string): string => {
  if (typeof num === 'string') {
    const parsed = parseInt(num, 10);
    return parsed === 0 ? "0" : parsed.toString();
  }
  return num === 0 ? "0" : num.toString();
};

export const displayCoordinates = (x: number | string, y: number | string): string => {
  return `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
};

export const hexToDecimal = (hex: string): number => {
  try {
    if (!hex || hex === '0x0') return 0;
    
    // Validate hex format
    if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(hex)) {
      logError('HEX_TO_DECIMAL', new Error('Invalid hex format'), {
        component: 'formatting',
        metadata: { hex, type: typeof hex }
      });
      return 0;
    }
    
    const result = parseInt(hex, 16) / 1e18; // Assuming 18 decimals
    
    if (!isFinite(result)) {
      logError('HEX_TO_DECIMAL', new Error('Result is not finite'), {
        component: 'formatting', 
        metadata: { hex, result }
      });
      return 0;
    }
    
    return result;
  } catch (error) {
    logError('HEX_TO_DECIMAL', error, {
      component: 'formatting',
      metadata: { hex }
    });
    return 0;
  }
};

export const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) return 'NUKABLE';
  
  // Convert to minutes for better precision but round to whole minutes
  const totalMinutes = Math.round(hours * 60);
  
  // Calculate hours and remaining minutes
  const hoursLeft = Math.floor(totalMinutes / 60);
  const minutesLeft = totalMinutes % 60;
  
  // Add warning indicator for 10 minutes or less
  const timeString = hoursLeft === 0 ? `${minutesLeft}m` : `${hoursLeft}h ${minutesLeft}m`;
  return totalMinutes <= 10 ? `⚠️ ${timeString}` : timeString;
};

export const formatYield = (yield_: number): string => {
  if (yield_ === 0) return '0/h';
  if (yield_ < 0.01) return '< 0.01/h';
  return `+${yield_.toFixed(2)}/h`;
};

export const convertToESTRK = (price: string | null, symbol: string, ratio: number | null): number => {
  if (!price || symbol === 'nftSTRK') return Number(formatOriginalPrice(price));
  if (ratio === null || ratio === undefined) return 0;
  return Number(calculateESTRKPrice(price, ratio));
}; 
import { TokenPrice } from '../types/ponziland';
import { getTokenMetadata } from '../data/tokenMetadata';
import { logError } from './errorHandler';

export const BASE_TOKEN_SYMBOL = 'STRK';

export const normalizeTokenAddress = (address?: string | null): string => {
  if (!address) return '';
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) return '';

  if (!trimmed.startsWith('0x')) {
    return trimmed;
  }

  const normalizedBody = trimmed.slice(2).replace(/^0+/, '');
  if (!normalizedBody) {
    return '0x0';
  }

  return `0x${normalizedBody}`;
};

const COMPACT_SUFFIXES = ['','K','M','B','T'];

export const formatCompactNumber = (value: number, decimals = 1): string => {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1000) {
    return value.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  const tier = Math.min(
    COMPACT_SUFFIXES.length - 1,
    Math.floor(Math.log10(abs) / 3),
  );

  const scaled = value / Math.pow(1000, tier);
  const formatted = scaled.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  return `${formatted}${COMPACT_SUFFIXES[tier]}`;
};

export const formatStrkAmount = (
  value: number,
  { decimals = 2, compact = true }: { decimals?: number; compact?: boolean } = {},
): string => {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);

  if (compact && abs >= 100_000) {
    return formatCompactNumber(value, decimals);
  }

  return value
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
};

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
    
    if (ratio >= 1_000_000) {
      return formatCompactNumber(ratio, 2);
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

export interface TokenInfo {
  symbol: string;
  ratio: number | null;
  decimals: number;
}

const DEFAULT_TOKEN_INFO: TokenInfo = {
  symbol: BASE_TOKEN_SYMBOL,
  ratio: 1,
  decimals: 18,
};

export const formatTokenAmount = (value: number | string, decimals = 2): string => {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return '0';
  }

  const abs = Math.abs(numericValue);

  if (abs >= 1_000) {
    return formatCompactNumber(numericValue, 2);
  }

  const dynamicDecimals = abs >= 1
    ? Math.min(decimals, 4)
    : Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1));

  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: dynamicDecimals,
    maximumFractionDigits: dynamicDecimals,
  });
};

export const getTokenInfo = (address: string, prices: TokenPrice[]): TokenInfo => {
  if (!address) {
    return { ...DEFAULT_TOKEN_INFO, symbol: 'Unknown', ratio: null };
  }

  const addrKey = normalizeTokenAddress(address);
  const tokenPrice = prices.find(p => normalizeTokenAddress(p.address) === addrKey);
  const metadata = getTokenMetadata(address);

  return {
    symbol: tokenPrice?.symbol ?? metadata?.symbol ?? 'Unknown',
    ratio: tokenPrice?.ratio ?? null,
    decimals: metadata?.decimals ?? DEFAULT_TOKEN_INFO.decimals,
  };
};

// Performance optimized version using cache
export const getTokenInfoCached = (
  address: string,
  tokenCache: Map<string, TokenInfo>,
): TokenInfo => {
  const normalizedKey = normalizeTokenAddress(address);
  if (tokenCache.has(normalizedKey)) {
    return tokenCache.get(normalizedKey)!;
  }

  const lowerKey = (address || '').toLowerCase();
  if (tokenCache.has(lowerKey)) {
    return tokenCache.get(lowerKey)!;
  }

  return tokenCache.get('') || DEFAULT_TOKEN_INFO;
};

const toPowerOfTen = (decimals: number): bigint => {
  if (decimals <= 0) {
    return 1n;
  }
  return 10n ** BigInt(decimals);
};

const formatRawAmount = (raw: bigint, decimals: number, fallback = '0'): string => {
  if (raw === 0n) {
    return fallback;
  }

  const divisor = toPowerOfTen(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionString = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');

  const trimmedFraction = fractionString.slice(0, Math.min(6, fractionString.length));
  return `${whole.toString()}.${trimmedFraction}`;
};

export const formatOriginalPrice = (
  price: string | null,
  decimals = 18,
  options?: { compact?: boolean; tokenDecimals?: number },
): string => {
  if (!price) return 'Not for sale';
  try {
    const raw = BigInt(price);
    const formatted = formatRawAmount(raw, decimals, '0');
    if (options?.compact) {
      const numeric = Number(formatted);
      return formatTokenAmount(
        Number.isFinite(numeric) ? numeric : formatted,
        options.tokenDecimals ?? Math.min(4, decimals),
      );
    }
    return formatted;
  } catch (error) {
    logError('FORMAT_ORIGINAL_PRICE', error, {
      component: 'formatting',
      metadata: { price, decimals }
    });
    return '0';
  }
};

export const convertToSTRK = (
  price: string | null,
  symbol: string,
  ratio: number | null,
  decimals = 18,
): number => {
  if (!price) return 0;

  let numeric = 0;
  try {
    const raw = BigInt(price);
    const divisor = toPowerOfTen(decimals);
    const whole = Number(raw / divisor);
    const fraction = Number(raw % divisor) / Number(divisor);
    numeric = whole + fraction;
  } catch (error) {
    logError('CONVERT_TO_STRK', error, {
      component: 'formatting',
      metadata: { price, symbol, decimals }
    });
    return 0;
  }

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const normalizedSymbol = symbol?.toUpperCase();
  if (!normalizedSymbol || normalizedSymbol === BASE_TOKEN_SYMBOL) {
    return numeric;
  }

  if (ratio === null || ratio === undefined || ratio <= 0) {
    return numeric;
  }

  return numeric / ratio;
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

const coerceToBigInt = (input: string | number | bigint | null | undefined): bigint => {
  if (input === null || input === undefined) {
    return 0n;
  }

  if (typeof input === 'bigint') {
    return input;
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error('Invalid numeric input');
    }
    return BigInt(Math.trunc(input));
  }

  if (typeof input !== 'string') {
    throw new Error('Unsupported value type');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return 0n;
  }

  return BigInt(trimmed);
};

export const hexToDecimal = (value: string | number | bigint, decimals = 18): number => {
  try {
    const raw = coerceToBigInt(value);
    if (raw === 0n) {
      return 0;
    }

    const divisor = toPowerOfTen(decimals);
    const whole = Number(raw / divisor);
    const fractionRaw = raw % divisor;

    const fraction = Number(fractionRaw) / Number(divisor);
    return whole + fraction;
  } catch (error) {
    logError('HEX_TO_DECIMAL', error, {
      component: 'formatting',
      metadata: { value }
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

export const convertTokenAmountToSTRK = convertToSTRK;

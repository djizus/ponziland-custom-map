import { PonziLandAuction, PonziLandConfig } from '../types/ponziland';
import {
  DECIMALS_FACTOR,
  AUCTION_DURATION,
  LINEAR_DECAY_TIME,
  DROP_RATE,
  RATE_DENOMINATOR,
  SCALING_FACTOR,
  TIME_SPEED
} from '../constants/ponziland';

const toBigInt = (value: number | string | bigint | undefined | null, fallback: bigint): bigint => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return BigInt(Math.trunc(value));
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return fallback;
  }
};

const parseTimestamp = (value: string | number | bigint | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.floor(value) : 0;
  }

  if (typeof value === 'bigint') {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const base = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? 16 : 10;
  const parsed = parseInt(trimmed, base);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveAuctionParameters = (config?: PonziLandConfig) => {
  const auctionDuration = toBigInt(config?.auction_duration, BigInt(AUCTION_DURATION));
  const linearDecayTime = toBigInt(config?.linear_decay_time, BigInt(LINEAR_DECAY_TIME));
  const dropRate = toBigInt(config?.drop_rate, DROP_RATE);
  const rateDenominator = toBigInt(config?.rate_denominator, RATE_DENOMINATOR);
  const scalingFactor = toBigInt(config?.scaling_factor, SCALING_FACTOR);
  const timeSpeed = toBigInt(config?.time_speed, TIME_SPEED);

  return {
    auctionDuration,
    linearDecayTime,
    dropRate,
    rateDenominator,
    scalingFactor,
    timeSpeed
  };
};

export const getElapsedSeconds = (auction: PonziLandAuction): number => {
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = parseTimestamp(auction.start_time);
  return Math.max(0, currentTime - startTime);
};

export function getCurrentAuctionPriceDecayRate(
  startTime: bigint,
  startPrice: bigint,
  floorPrice: bigint,
  decayRate: bigint,
  currentTime: bigint,
  config?: PonziLandConfig
): bigint {
  const {
    auctionDuration,
    linearDecayTime,
    dropRate,
    rateDenominator,
    scalingFactor,
    timeSpeed
  } = resolveAuctionParameters(config);

  // Calculate time passed, scaled by TIME_SPEED
  const timePassed = currentTime > startTime
    ? (currentTime - startTime) * timeSpeed
    : 0n;

  // If auction duration exceeded, price is 0
  if (timePassed >= auctionDuration) {
    return 0n;
  }

  let currentPrice = startPrice;

  // --- Linear phase ---
  if (timePassed <= linearDecayTime) {
    const timeFraction = timePassed * DECIMALS_FACTOR / linearDecayTime;
    const linearFactor = DECIMALS_FACTOR - (dropRate * timeFraction / rateDenominator);
    currentPrice = startPrice * linearFactor / DECIMALS_FACTOR;
  } else {
    // --- Quadratic phase ---
    const remainingRate = rateDenominator - dropRate;
    const priceAfterLinear = startPrice * remainingRate / rateDenominator;

    const progressTime = timePassed * DECIMALS_FACTOR / auctionDuration;

    // k is the decay rate (adjusted by DECIMALS_FACTOR for scaling)
    const k = decayRate * DECIMALS_FACTOR / scalingFactor;

    // Calculate the denominator (1 + k * t) using scaled values for precision
    const denominator = DECIMALS_FACTOR + (k * progressTime / DECIMALS_FACTOR);

    // Calculate the decay factor using the formula (1 / (1 + k * t))^2
    let decayFactor: bigint;
    if (denominator !== 0n) {
      const temp = (DECIMALS_FACTOR * DECIMALS_FACTOR) / denominator;
      decayFactor = (temp * temp) / DECIMALS_FACTOR;
    } else {
      decayFactor = 0n;
    }

    currentPrice = priceAfterLinear * decayFactor / DECIMALS_FACTOR;
  }

  return currentPrice > floorPrice ? currentPrice : floorPrice;
}

export function calculateAuctionPrice(auction: PonziLandAuction, config?: PonziLandConfig): number {
  const startPrice = toBigInt(auction.start_price, 0n);
  const floorPrice = toBigInt(auction.floor_price, 0n);
  const decayRate =
    typeof auction.decay_rate !== 'undefined' && auction.decay_rate !== null
      ? toBigInt(auction.decay_rate, 0n)
      : config?.decay_rate !== undefined && config.decay_rate !== null
        ? toBigInt(config.decay_rate, 0n)
        : undefined;
  const startTime = toBigInt(auction.start_time, 0n);
  const currentTime = BigInt(Math.floor(Date.now() / 1000));

  if (typeof decayRate === 'undefined') {
    // New Torii responses may omit decay_rate; fall back to start price constrained by floor
    const fallbackPrice = startPrice > floorPrice ? startPrice : floorPrice;
    return Number(fallbackPrice) / Number(DECIMALS_FACTOR);
  }

  const price = getCurrentAuctionPriceDecayRate(startTime, startPrice, floorPrice, decayRate, currentTime, config);
  return Number(price) / Number(DECIMALS_FACTOR);
}

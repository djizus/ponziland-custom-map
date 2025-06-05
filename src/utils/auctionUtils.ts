import { PonziLandAuction } from '../types/ponziland';
import {
  DECIMALS_FACTOR,
  AUCTION_DURATION,
  LINEAR_DECAY_TIME,
  DROP_RATE,
  RATE_DENOMINATOR,
  SCALING_FACTOR,
  TIME_SPEED
} from '../constants/ponziland';

export const getElapsedSeconds = (auction: PonziLandAuction): number => {
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = parseInt(auction.start_time);
  return Math.max(0, currentTime - startTime);
};

export function getCurrentAuctionPriceDecayRate(
  startTime: bigint,
  startPrice: bigint,
  floorPrice: bigint,
  decayRate: bigint,
  currentTime: bigint
): bigint {
  // Calculate time passed, scaled by TIME_SPEED
  const timePassed = currentTime > startTime
    ? (currentTime - startTime) * TIME_SPEED
    : 0n;

  // If auction duration exceeded, price is 0
  if (timePassed >= BigInt(AUCTION_DURATION)) {
    return 0n;
  }

  let currentPrice = startPrice;

  // --- Linear phase ---
  if (timePassed <= BigInt(LINEAR_DECAY_TIME)) {
    const timeFraction = timePassed * DECIMALS_FACTOR / BigInt(LINEAR_DECAY_TIME);
    const linearFactor = DECIMALS_FACTOR - (DROP_RATE * timeFraction / RATE_DENOMINATOR);
    currentPrice = startPrice * linearFactor / DECIMALS_FACTOR;
  } else {
    // --- Quadratic phase ---
    const remainingRate = RATE_DENOMINATOR - DROP_RATE;
    const priceAfterLinear = startPrice * remainingRate / RATE_DENOMINATOR;

    const progressTime = timePassed * DECIMALS_FACTOR / BigInt(AUCTION_DURATION);

    // k is the decay rate (adjusted by DECIMALS_FACTOR for scaling)
    const k = decayRate * DECIMALS_FACTOR / SCALING_FACTOR;

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

export function calculateAuctionPrice(auction: PonziLandAuction): number {
  const startPrice = BigInt(auction.start_price);
  const floorPrice = auction.floor_price ? BigInt(auction.floor_price) : 0n;
  const decayRate = BigInt(auction.decay_rate);
  const startTime = BigInt(parseInt(auction.start_time, 16));
  const currentTime = BigInt(Math.floor(Date.now() / 1000));

  const price = getCurrentAuctionPriceDecayRate(startTime, startPrice, floorPrice, decayRate, currentTime);
  return Number(price) / Number(DECIMALS_FACTOR);
} 
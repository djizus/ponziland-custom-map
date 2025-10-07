import { useEffect, useRef, useState } from 'react';
import { PonziLand, PonziLandAuction, PonziLandConfig, GameEvent } from '../types/ponziland';
import { getCoordinates, normalizeLocation } from '../utils/dataProcessing';
import { DECIMALS_FACTOR } from '../constants/ponziland';
import { calculateAuctionPrice } from '../utils/auctionUtils';

type OwnerSnapshot = {
  ownerLower: string;
  ownerRaw: string;
};

const parseBigInt = (value: string | number | bigint | null | undefined): bigint => {
  if (value === null || value === undefined) {
    return 0n;
  }

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0n;
    }
    return BigInt(Math.trunc(value));
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0n;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return 0n;
  }
};

const convertToStrk = (value: string | number | bigint | null | undefined): number => {
  const parsed = parseBigInt(value);
  if (parsed === 0n) {
    return 0;
  }

  const divisor = Number(DECIMALS_FACTOR);
  if (divisor === 0) {
    return 0;
  }

  const integerPart = parsed / DECIMALS_FACTOR;
  const fractionalPart = parsed % DECIMALS_FACTOR;

  return Number(integerPart) + Number(fractionalPart) / divisor;
};

const formatCoords = (location: number): string => {
  const [col, row] = getCoordinates(location);
  return `${col}, ${row}`;
};

const parseAuctionTimestampMs = (value: string | number | bigint | null | undefined, fallback: number): number => {
  const secondsBig = parseBigInt(value);
  if (secondsBig <= 0n) {
    return fallback;
  }

  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const clampedSeconds = secondsBig > maxSafe ? maxSafe : secondsBig;
  const secondsNumber = Number(clampedSeconds);
  const millis = secondsNumber * 1000;
  if (!Number.isFinite(millis) || millis <= 0) {
    return fallback;
  }

  return Math.min(millis, fallback);
};

export const useGameEvents = (
  landsSqlData: PonziLand[],
  auctionsSqlData: PonziLandAuction[],
  configSqlData: PonziLandConfig | null
): GameEvent[] => {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const ownersRef = useRef<Map<number, OwnerSnapshot>>(new Map());
  const auctionsRef = useRef<Map<number, PonziLandAuction>>(new Map());
  const initializedRef = useRef(false);
  const counterRef = useRef(0);

  useEffect(() => {
    const currentOwners = new Map<number, OwnerSnapshot>();
    const currentAuctions = new Map<number, PonziLandAuction>();

    landsSqlData.forEach(land => {
      const normalized = normalizeLocation(land.location);
      if (normalized === null) {
        return;
      }

      const ownerRaw = (land.owner || '').trim();
      currentOwners.set(normalized, {
        ownerLower: ownerRaw.toLowerCase(),
        ownerRaw,
      });
    });

    auctionsSqlData.forEach(auction => {
      if (auction.is_finished) {
        return;
      }

      const normalized = normalizeLocation(auction.land_location);
      if (normalized === null) {
        return;
      }

      currentAuctions.set(normalized, auction);
    });

    if (!initializedRef.current) {
      ownersRef.current = currentOwners;
      auctionsRef.current = currentAuctions;
      initializedRef.current = true;
      return;
    }

    const newEvents: GameEvent[] = [];
    const now = Date.now();

    // Detect owner changes
    currentOwners.forEach((snapshot, location) => {
      const previous = ownersRef.current.get(location);
      if (!previous) {
        if (snapshot.ownerLower) {
          counterRef.current += 1;
          newEvents.push({
          id: `owner-change-${location}-${now}-${counterRef.current}`,
          type: 'owner-change',
          timestamp: now,
          detectedAt: now,
          location,
          coords: formatCoords(location),
          newOwnerAddress: snapshot.ownerRaw,
        });
        }
        return;
      }

      if (previous.ownerLower !== snapshot.ownerLower) {
        counterRef.current += 1;
        newEvents.push({
          id: `owner-change-${location}-${now}-${counterRef.current}`,
          type: 'owner-change',
          timestamp: now,
          detectedAt: now,
          location,
          coords: formatCoords(location),
          newOwnerAddress: snapshot.ownerRaw,
          previousOwnerAddress: previous.ownerRaw,
        });
      }
    });

    // Detect owners removed (land reset)
    ownersRef.current.forEach((snapshot, location) => {
      if (!currentOwners.has(location) && snapshot.ownerLower) {
        counterRef.current += 1;
        newEvents.push({
          id: `owner-change-${location}-${now}-${counterRef.current}`,
          type: 'owner-change',
          timestamp: now,
          detectedAt: now,
          location,
          coords: formatCoords(location),
          previousOwnerAddress: snapshot.ownerRaw,
        });
      }
    });

    // Detect auction starts
    currentAuctions.forEach((auction, location) => {
      if (!auctionsRef.current.has(location)) {
        counterRef.current += 1;
        const eventTimestamp = parseAuctionTimestampMs(auction.start_time, now);
        newEvents.push({
          id: `auction-start-${location}-${now}-${counterRef.current}`,
          type: 'auction-start',
          timestamp: eventTimestamp,
          detectedAt: now,
          location,
          coords: formatCoords(location),
          auctionStartPriceSTRK: convertToStrk(auction.start_price),
          auctionFloorPriceSTRK: convertToStrk(auction.floor_price),
          auctionCurrentPriceSTRK: calculateAuctionPrice(auction, configSqlData || undefined),
          auctionStartTimeRaw: typeof auction.start_time === 'string' ? auction.start_time : String(auction.start_time ?? ''),
        });
      }
    });

    // Detect auction endings
    auctionsRef.current.forEach((_auction, location) => {
      if (!currentAuctions.has(location)) {
        counterRef.current += 1;
        newEvents.push({
          id: `auction-end-${location}-${now}-${counterRef.current}`,
          type: 'auction-end',
          timestamp: now,
          detectedAt: now,
          location,
          coords: formatCoords(location),
        });
      }
    });

    if (newEvents.length > 0) {
      if (typeof console !== 'undefined' && console.info) {
        console.info('[GameEvents] detected updates', newEvents.map(event => ({
          id: event.id,
          type: event.type,
          location: event.location,
          timestamp: new Date(event.timestamp).toISOString(),
          detectedAt: new Date(event.detectedAt).toISOString(),
          deltaSeconds: Number.isFinite(event.detectedAt - event.timestamp)
            ? Math.round((event.detectedAt - event.timestamp) / 1000)
            : null,
          rawStartTime: event.auctionStartTimeRaw ?? null,
        })));
      }
      setEvents(prev => {
        const combined = [...newEvents, ...prev];
        return combined.slice(0, 200);
      });
    }

    ownersRef.current = currentOwners;
    auctionsRef.current = currentAuctions;
  }, [landsSqlData, auctionsSqlData, configSqlData]);

  return events;
};

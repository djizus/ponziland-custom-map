import { useState, useEffect, useMemo } from 'react';
import { PonziLand } from '../types/ponziland';
import { logError } from '../utils/errorHandler';
import { apiClient } from '../utils/apiClient';
import { isZeroAddress, ZERO_ADDRESS } from '../utils/formatting';

export const usePlayerManagement = (
  gridData: { tiles: (PonziLand | null)[] },
  loadingSql: boolean
) => {
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});
  const [allPlayers, setAllPlayers] = useState<Array<{ address: string; displayName: string; originalAddress: string }>>([]);

  // Extract owner addresses to minimize effect dependencies
  const ownerAddresses = useMemo(() => {
    const addresses = new Set<string>();
    gridData.tiles.forEach(tile => {
      if (tile?.owner) {
        const normalizedOwner = isZeroAddress(tile.owner) ? ZERO_ADDRESS : tile.owner;
        addresses.add(normalizedOwner);
      }
    });
    return addresses;
  }, [gridData.tiles]);

  useEffect(() => {
    if (ownerAddresses.size === 0 && !loadingSql) {
      setAllPlayers([]);
      return;
    }

    const addressesToFetchUsernamesFor: string[] = [];
    
    ownerAddresses.forEach(mapOwnerAddr => {
      const addrKey = mapOwnerAddr.toLowerCase();
      if (!isZeroAddress(mapOwnerAddr) && !usernameCache[addrKey]) {
        addressesToFetchUsernamesFor.push(mapOwnerAddr);
      }
    });
    
    if (addressesToFetchUsernamesFor.length > 0) {
      const fetchUsernamesForSpecificAddresses = async () => {
        try {
          // Use the new API client with batching and deduplication
          const fetchedData = await apiClient.fetchUsernames(addressesToFetchUsernamesFor);
          
          setUsernameCache(prevCache => {
            const newCache = { ...prevCache };
            Object.assign(newCache, fetchedData);
            return newCache;
          });
        } catch (error) {
          logError('USERNAME_FETCH', error, {
            component: 'usePlayerManagement',
            operation: 'fetchUsernamesForSpecificAddresses',
            metadata: { 
              addressCount: addressesToFetchUsernamesFor.length,
              silent: true // This is expected to fail sometimes
            }
          });
        }
      };
      fetchUsernamesForSpecificAddresses();
    }

    const uniqueOwnerEntriesForPlayerList = new Map<string, { address: string; displayName: string; originalAddress: string }>();
    ownerAddresses.forEach(mapOwnerAddr => {
      const isAuctionAddress = isZeroAddress(mapOwnerAddr);
      const addrKey = isAuctionAddress
        ? ZERO_ADDRESS.toLowerCase()
        : mapOwnerAddr.toLowerCase();
      const username = usernameCache[addrKey];

      if (!uniqueOwnerEntriesForPlayerList.has(addrKey)) {
        uniqueOwnerEntriesForPlayerList.set(addrKey, {
          address: addrKey,
          originalAddress: mapOwnerAddr,
          displayName: isAuctionAddress
            ? 'Auctions'
            : (username || `${mapOwnerAddr.slice(0,6)}...${mapOwnerAddr.slice(-4)}`)
        });
      }
    });

    const sortedPlayers = Array.from(uniqueOwnerEntriesForPlayerList.values()).sort((a,b) => a.displayName.localeCompare(b.displayName));
    setAllPlayers(sortedPlayers);

  }, [ownerAddresses, usernameCache, loadingSql]);

  return {
    usernameCache,
    allPlayers
  };
};

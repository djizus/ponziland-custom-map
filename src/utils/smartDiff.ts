// Smart diffing utilities for performance optimization

// Efficient array comparison for prices
export const comparePricesArrays = (prev: any[], next: any[]): boolean => {
  if (prev.length !== next.length) return false;
  
  for (let i = 0; i < prev.length; i++) {
    const prevItem = prev[i];
    const nextItem = next[i];
    
    if (prevItem.symbol !== nextItem.symbol || 
        prevItem.ratio !== nextItem.ratio ||
        prevItem.address !== nextItem.address) {
      return false;
    }
  }
  return true;
};

// Efficient comparison for land data
export const compareLandArrays = (prev: any[], next: any[]): boolean => {
  if (prev.length !== next.length) return false;
  
  // Compare only critical fields that affect calculations
  for (let i = 0; i < prev.length; i++) {
    const prevLand = prev[i];
    const nextLand = next[i];
    
    if (!prevLand && !nextLand) continue;
    if (!prevLand || !nextLand) return false;
    
    if (prevLand.location !== nextLand.location ||
        prevLand.sell_price !== nextLand.sell_price ||
        prevLand.owner !== nextLand.owner ||
        prevLand.level !== nextLand.level ||
        prevLand.staked_amount !== nextLand.staked_amount ||
        prevLand.token_used !== nextLand.token_used) {
      return false;
    }
  }
  return true;
};

// Efficient comparison for auction data
export const compareAuctionArrays = (prev: any[], next: any[]): boolean => {
  if (prev.length !== next.length) return false;
  
  for (let i = 0; i < prev.length; i++) {
    const prevAuction = prev[i];
    const nextAuction = next[i];
    
    if (prevAuction.land_location !== nextAuction.land_location ||
        prevAuction.start_time !== nextAuction.start_time ||
        prevAuction.start_price !== nextAuction.start_price ||
        prevAuction.decay_rate !== nextAuction.decay_rate ||
        prevAuction.is_finished !== nextAuction.is_finished ||
        prevAuction.floor_price !== nextAuction.floor_price) {
      return false;
    }
  }
  return true;
};

// Hash-based comparison for large datasets
export const hashArray = (arr: any[]): string => {
  let hash = 0;
  const str = JSON.stringify(arr);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// Shallow comparison for objects
export const shallowEqual = (obj1: any, obj2: any): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
};
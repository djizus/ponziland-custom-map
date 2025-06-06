// Performance cache for expensive calculations
export class PerformanceCache {
  private static instance: PerformanceCache;
  
  // Cache storage
  private taxRateCache = new Map<string, number>();
  private burnRateCache = new Map<string, number>();
  private timeRemainingCache = new Map<string, number>();
  private neighborYieldCache = new Map<string, any>();
  private purchaseRecommendationCache = new Map<string, any>();
  
  // Version tracking for cache invalidation
  private dataVersions = {
    lands: 0,
    auctions: 0,
    stakes: 0,
    prices: 0
  };
  
  private constructor() {}
  
  public static getInstance(): PerformanceCache {
    if (!PerformanceCache.instance) {
      PerformanceCache.instance = new PerformanceCache();
    }
    return PerformanceCache.instance;
  }
  
  // Generate cache keys
  private getTaxRateKey(level: string, location: number): string {
    return `tax_${level}_${location}`;
  }
  
  private getBurnRateKey(location: number, landsVersion: number, auctionsVersion: number): string {
    return `burn_${location}_${landsVersion}_${auctionsVersion}`;
  }
  
  private getTimeRemainingKey(location: number, landsVersion: number, auctionsVersion: number): string {
    return `time_${location}_${landsVersion}_${auctionsVersion}`;
  }
  
  private getNeighborYieldKey(location: number, constrainToMyDuration: boolean, myTimeRemaining: number | undefined, durationCapHours: number): string {
    return `neighbor_v2_${location}_${constrainToMyDuration}_${myTimeRemaining || 0}_${durationCapHours}_${this.dataVersions.lands}_${this.dataVersions.auctions}_${this.dataVersions.prices}`;
  }
  
  private getPurchaseRecommendationKey(location: number, currentAuctionPrice: number | undefined, durationCapHours: number): string {
    return `purchase_v2_${location}_${currentAuctionPrice || 0}_${durationCapHours}_${this.dataVersions.lands}_${this.dataVersions.auctions}_${this.dataVersions.prices}`;
  }
  
  // Tax rate caching
  public getTaxRate(level: string, location: number, calculator: () => number): number {
    const key = this.getTaxRateKey(level, location);
    if (this.taxRateCache.has(key)) {
      return this.taxRateCache.get(key)!;
    }
    
    const result = calculator();
    this.taxRateCache.set(key, result);
    return result;
  }
  
  // Burn rate caching
  public getBurnRate(location: number, calculator: () => number): number {
    const key = this.getBurnRateKey(location, this.dataVersions.lands, this.dataVersions.auctions);
    if (this.burnRateCache.has(key)) {
      return this.burnRateCache.get(key)!;
    }
    
    const result = calculator();
    this.burnRateCache.set(key, result);
    return result;
  }
  
  // Time remaining caching
  public getTimeRemaining(location: number, calculator: () => number): number {
    const key = this.getTimeRemainingKey(location, this.dataVersions.lands, this.dataVersions.auctions);
    if (this.timeRemainingCache.has(key)) {
      return this.timeRemainingCache.get(key)!;
    }
    
    const result = calculator();
    this.timeRemainingCache.set(key, result);
    return result;
  }
  
  // Neighbor yield caching
  public getNeighborYield(
    location: number, 
    constrainToMyDuration: boolean, 
    myTimeRemaining: number | undefined, 
    durationCapHours: number,
    calculator: () => any
  ): any {
    const key = this.getNeighborYieldKey(location, constrainToMyDuration, myTimeRemaining, durationCapHours);
    if (this.neighborYieldCache.has(key)) {
      return this.neighborYieldCache.get(key)!;
    }
    
    const result = calculator();
    this.neighborYieldCache.set(key, result);
    return result;
  }
  
  // Purchase recommendation caching
  public getPurchaseRecommendation(
    location: number,
    currentAuctionPrice: number | undefined,
    durationCapHours: number,
    calculator: () => any
  ): any {
    const key = this.getPurchaseRecommendationKey(location, currentAuctionPrice, durationCapHours);
    if (this.purchaseRecommendationCache.has(key)) {
      return this.purchaseRecommendationCache.get(key)!;
    }
    
    const result = calculator();
    this.purchaseRecommendationCache.set(key, result);
    return result;
  }
  
  // Version update methods for cache invalidation
  public updateLandsVersion(): void {
    this.dataVersions.lands++;
    this.invalidateRelatedCaches(['burn', 'time', 'neighbor', 'purchase']);
  }
  
  public updateAuctionsVersion(): void {
    this.dataVersions.auctions++;
    this.invalidateRelatedCaches(['burn', 'time', 'neighbor', 'purchase']);
  }
  
  public updateStakesVersion(): void {
    this.dataVersions.stakes++;
    this.invalidateRelatedCaches(['burn', 'time', 'neighbor', 'purchase']);
  }
  
  public updatePricesVersion(): void {
    this.dataVersions.prices++;
    this.invalidateRelatedCaches(['neighbor', 'purchase']);
  }
  
  // Selective cache invalidation
  private invalidateRelatedCaches(cacheTypes: string[]): void {
    if (cacheTypes.includes('burn')) {
      this.burnRateCache.clear();
    }
    if (cacheTypes.includes('time')) {
      this.timeRemainingCache.clear();
    }
    if (cacheTypes.includes('neighbor')) {
      this.neighborYieldCache.clear();
    }
    if (cacheTypes.includes('purchase')) {
      this.purchaseRecommendationCache.clear();
    }
  }
  
  // Memory management
  public cleanupOldEntries(): void {
    // Keep cache sizes reasonable
    const maxCacheSize = 1000;
    
    if (this.taxRateCache.size > maxCacheSize) {
      this.taxRateCache.clear();
    }
    if (this.burnRateCache.size > maxCacheSize) {
      this.burnRateCache.clear();
    }
    if (this.timeRemainingCache.size > maxCacheSize) {
      this.timeRemainingCache.clear();
    }
    if (this.neighborYieldCache.size > maxCacheSize) {
      this.neighborYieldCache.clear();
    }
    if (this.purchaseRecommendationCache.size > maxCacheSize) {
      this.purchaseRecommendationCache.clear();
    }
  }
  
  // Debug method
  public getCacheStats(): object {
    return {
      taxRateCache: this.taxRateCache.size,
      burnRateCache: this.burnRateCache.size,
      timeRemainingCache: this.timeRemainingCache.size,
      neighborYieldCache: this.neighborYieldCache.size,
      purchaseRecommendationCache: this.purchaseRecommendationCache.size,
      dataVersions: this.dataVersions
    };
  }
}

export const performanceCache = PerformanceCache.getInstance();
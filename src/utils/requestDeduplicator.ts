/**
 * Request deduplication utility to prevent duplicate API calls
 * and optimize network usage across the application
 */

import { logError } from './errorHandler';

interface RequestConfig {
  url: string;
  options?: RequestInit;
  ttl?: number; // Time to live in milliseconds
}

interface CachedRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  ttl: number;
}

export class RequestDeduplicator {
  private pendingRequests = new Map<string, CachedRequest<any>>();
  private responseCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * Generate a unique key for the request
   */
  private generateKey(config: RequestConfig): string {
    const { url, options } = config;
    const method = options?.method || 'GET';
    const body = options?.body || '';
    const headers = JSON.stringify(options?.headers || {});
    return `${method}:${url}:${body}:${headers}`;
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    // Clean pending requests
    for (const [key, request] of this.pendingRequests.entries()) {
      if (!this.isCacheValid(request.timestamp, request.ttl)) {
        this.pendingRequests.delete(key);
      }
    }
    
    // Clean response cache
    for (const [key, cached] of this.responseCache.entries()) {
      if (!this.isCacheValid(cached.timestamp, cached.ttl)) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Deduplicate and cache HTTP requests
   */
  async request<T>(config: RequestConfig): Promise<T> {
    const key = this.generateKey(config);
    const ttl = config.ttl || 30000; // Default 30 seconds
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      this.cleanup();
    }

    // Check response cache first
    const cached = this.responseCache.get(key);
    if (cached && this.isCacheValid(cached.timestamp, cached.ttl)) {
      return cached.data;
    }

    // Check if request is already pending
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest && this.isCacheValid(pendingRequest.timestamp, pendingRequest.ttl)) {
      return pendingRequest.promise;
    }

    // Create new request
    const requestPromise = this.executeRequest<T>(config);
    
    // Store pending request
    this.pendingRequests.set(key, {
      promise: requestPromise,
      timestamp: now,
      ttl
    });

    try {
      const result = await requestPromise;
      
      // Cache successful response
      this.responseCache.set(key, {
        data: result,
        timestamp: now,
        ttl
      });
      
      // Remove from pending
      this.pendingRequests.delete(key);
      
      return result;
    } catch (error) {
      // Remove from pending on error
      this.pendingRequests.delete(key);
      throw error;
    }
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<T>(config: RequestConfig): Promise<T> {
    try {
      const response = await fetch(config.url, config.options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as T;
    } catch (error) {
      logError('REQUEST_DEDUPLICATOR', error, {
        component: 'RequestDeduplicator',
        operation: 'executeRequest',
        url: config.url,
        method: config.options?.method || 'GET'
      });
      throw error;
    }
  }

  /**
   * Invalidate cache for specific URL pattern
   */
  invalidateCache(urlPattern: string): void {
    const keysToDelete: string[] = [];
    
    // Find matching keys
    for (const key of this.responseCache.keys()) {
      if (key.includes(urlPattern)) {
        keysToDelete.push(key);
      }
    }
    
    // Delete matching entries
    keysToDelete.forEach(key => {
      this.responseCache.delete(key);
      this.pendingRequests.delete(key);
    });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.responseCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    pendingRequests: number;
    cachedResponses: number;
    cacheSize: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      cachedResponses: this.responseCache.size,
      cacheSize: this.pendingRequests.size + this.responseCache.size
    };
  }
}

// Global instance for request deduplication
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Convenience function for making deduplicated requests
 */
export const deduplicatedFetch = <T>(
  url: string, 
  options?: RequestInit, 
  ttl?: number
): Promise<T> => {
  return requestDeduplicator.request<T>({ url, options, ttl });
};

/**
 * Batch request utility for handling multiple related requests
 */
export class BatchRequestManager {
  private batches = new Map<string, {
    items: any[];
    timeout: ReturnType<typeof setTimeout>;
    resolve: (value: any[]) => void;
    reject: (error: any) => void;
  }>();

  /**
   * Add item to batch and process when ready
   */
  addToBatch<T>(
    batchKey: string,
    item: T,
    processor: (items: T[]) => Promise<any[]>,
    delay: number = 100
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const batch = this.batches.get(batchKey);
      
      if (batch) {
        // Add to existing batch
        batch.items.push(item);
        
        // Store resolve/reject for this item
        const itemIndex = batch.items.length - 1;
        const originalResolve = batch.resolve;
        const originalReject = batch.reject;
        
        batch.resolve = (results: any[]) => {
          resolve(results[itemIndex]);
          originalResolve(results);
        };
        
        batch.reject = (error: any) => {
          reject(error);
          originalReject(error);
        };
      } else {
        // Create new batch
        const timeout = setTimeout(async () => {
          const currentBatch = this.batches.get(batchKey);
          if (currentBatch) {
            this.batches.delete(batchKey);
            
            try {
              const results = await processor(currentBatch.items);
              currentBatch.resolve(results);
            } catch (error) {
              currentBatch.reject(error);
            }
          }
        }, delay);
        
        this.batches.set(batchKey, {
          items: [item],
          timeout,
          resolve: (results: any[]) => resolve(results[0]),
          reject
        });
      }
    });
  }

  /**
   * Clear all pending batches
   */
  clearBatches(): void {
    for (const batch of this.batches.values()) {
      clearTimeout(batch.timeout);
    }
    this.batches.clear();
  }
}

// Global instance for batch processing
export const batchRequestManager = new BatchRequestManager();
/**
 * Enhanced API client with request deduplication, caching, and proper error handling
 */

import { TokenPrice, PonziLand, PonziLandAuction, PonziLandStake, PonziLandConfig } from '../types/ponziland';
import { 
  SQL_API_URL, 
  SQL_GET_PONZI_LANDS, 
  SQL_GET_PONZI_LAND_AUCTIONS,
  SQL_GET_PONZI_LANDS_STAKE,
  SQL_GET_PONZI_CONFIG,
  PRICE_API_URL 
} from '../constants/ponziland';
import { deduplicatedFetch, batchRequestManager } from './requestDeduplicator';
import { logError, handleApiError } from './errorHandler';

export interface ApiClientConfig {
  enableDeduplication?: boolean;
  enableCaching?: boolean;
  defaultTtl?: number;
}

export class ApiClient {
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      enableDeduplication: config.enableDeduplication ?? true,
      enableCaching: config.enableCaching ?? true,
      defaultTtl: config.defaultTtl ?? 30000 // 30 seconds
    };
  }

  /**
   * Fetch token prices with deduplication and caching
   */
  async fetchPrices(signal?: AbortSignal): Promise<TokenPrice[]> {
    try {
      const options: RequestInit = {
        method: 'GET',
        headers: { Accept: 'application/json' },
        mode: 'cors',
        cache: 'no-store',
        ...(signal && { signal })
      };

      if (this.config.enableDeduplication) {
        return await deduplicatedFetch<TokenPrice[]>(PRICE_API_URL, options, this.config.defaultTtl);
      } else {
        const response = await fetch(PRICE_API_URL, options);
        if (!response.ok) {
          const error = await handleApiError(response, 'PRICE_FETCH');
          throw new Error(error.message);
        }
        return await response.json();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      
      logError('API_CLIENT_PRICES', error, {
        component: 'ApiClient',
        operation: 'fetchPrices'
      });
      throw error;
    }
  }

  /**
   * Fetch SQL data with batching and deduplication
   */
  async fetchSqlData(signal?: AbortSignal): Promise<{
    lands: PonziLand[];
    auctions: PonziLandAuction[];
    stakes: PonziLandStake[];
    config: PonziLandConfig | null;
  }> {
    try {
      const options: RequestInit = {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        ...(signal && { signal })
      };

      // Batch all SQL queries together
      const queries = [
        { name: 'lands', query: SQL_GET_PONZI_LANDS },
        { name: 'auctions', query: SQL_GET_PONZI_LAND_AUCTIONS },
        { name: 'stakes', query: SQL_GET_PONZI_LANDS_STAKE },
        { name: 'config', query: SQL_GET_PONZI_CONFIG }
      ];

      const results = await Promise.all(
        queries.map(({ name, query }) => 
          this.executeSqlQuery(query, name, options)
        )
      );

      return {
        lands: results[0] as PonziLand[],
        auctions: results[1] as PonziLandAuction[],
        stakes: results[2] as PonziLandStake[],
        config: ((results[3] as PonziLandConfig[]) || [])[0] || null
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      logError('API_CLIENT_SQL', error, {
        component: 'ApiClient',
        operation: 'fetchSqlData'
      });
      throw error;
    }
  }

  /**
   * Execute individual SQL query with proper error handling
   */
  private async executeSqlQuery<T>(
    query: string, 
    queryName: string, 
    options: RequestInit
  ): Promise<T[]> {
    const encodedQuery = encodeURIComponent(query);
    const fullUrl = `${SQL_API_URL}?query=${encodedQuery}`;

    try {
      if (this.config.enableDeduplication) {
        return await deduplicatedFetch<T[]>(
          fullUrl,
          options,
          this.config.defaultTtl / 2 // SQL data changes more frequently
        );
      } else {
        const response = await fetch(fullUrl, options);
        if (!response.ok) {
          const error = await handleApiError(response, `SQL_${queryName.toUpperCase()}`);
          throw new Error(error.message);
        }
        return await response.json();
      }
    } catch (error) {
      logError(`SQL_QUERY_${queryName.toUpperCase()}`, error, {
        component: 'ApiClient',
        operation: 'executeSqlQuery',
        metadata: { queryName, url: fullUrl }
      });
      throw error;
    }
  }

  /**
   * Fetch usernames with intelligent batching
   */
  async fetchUsernames(
    addresses: string[], 
    signal?: AbortSignal
  ): Promise<Record<string, string>> {
    try {
      if (addresses.length === 0) {
        return {};
      }

      // Use batch manager for efficient username fetching
      const result = await batchRequestManager.addToBatch(
        'usernames',
        addresses,
        async (allAddresses: string[][]) => {
          // Flatten and deduplicate addresses
          const uniqueAddresses = [...new Set(allAddresses.flat())];
          
          const options: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: uniqueAddresses }),
            ...(signal && { signal })
          };

          if (this.config.enableDeduplication) {
            const response = await deduplicatedFetch<any>(
              '/api/usernames',
              options,
              this.config.defaultTtl * 2 // Usernames change less frequently
            );
            return [this.processUsernameResponse(response)];
          } else {
            const fetchResponse = await fetch('/api/usernames', options);
            if (!fetchResponse.ok) {
              const error = await handleApiError(fetchResponse, 'USERNAME_FETCH');
              throw new Error(error.message);
            }
            const responseData = await fetchResponse.json();
            return [this.processUsernameResponse(responseData)];
          }
        },
        200 // 200ms batch delay
      );
      
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      logError('API_CLIENT_USERNAMES', error, {
        component: 'ApiClient',
        operation: 'fetchUsernames',
        metadata: { addressCount: addresses.length }
      });
      
      // Return empty object on error to prevent cascading failures
      return {};
    }
  }

  /**
   * Process username API response into consistent format
   */
  private processUsernameResponse(response: any): Record<string, string> {
    const usernameMap: Record<string, string> = {};
    
    try {
      if (Array.isArray(response)) {
        response.forEach((item: { username: string; address: string }) => {
          if (item.address && item.username) {
            usernameMap[item.address.toLowerCase()] = item.username;
          }
        });
      } else if (typeof response === 'object') {
        Object.assign(usernameMap, response);
      }
    } catch (error) {
      logError('USERNAME_RESPONSE_PROCESSING', error, {
        component: 'ApiClient',
        operation: 'processUsernameResponse'
      });
    }
    
    return usernameMap;
  }

  /**
   * Invalidate cache for specific endpoints
   */
  invalidateCache(pattern: string): void {
    // This would be implemented by the request deduplicator
    logError('CACHE_INVALIDATION', new Error('Cache invalidation requested'), {
      component: 'ApiClient',
      operation: 'invalidateCache',
      metadata: { pattern }
    });
  }

  /**
   * Get API client statistics
   */
  getStats(): any {
    // Return stats from request deduplicator if available
    return {
      message: 'Stats not implemented yet'
    };
  }
}

// Global API client instance
export const apiClient = new ApiClient({
  enableDeduplication: true,
  enableCaching: true,
  defaultTtl: 30000
});

/**
 * Convenience functions for common API operations
 */
export const fetchPrices = (signal?: AbortSignal) => apiClient.fetchPrices(signal);
export const fetchSqlData = (signal?: AbortSignal) => apiClient.fetchSqlData(signal);
export const fetchUsernames = (addresses: string[], signal?: AbortSignal) => 
  apiClient.fetchUsernames(addresses, signal);

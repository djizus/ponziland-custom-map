/**
 * Adaptive polling utility that adjusts polling intervals based on
 * user activity, page visibility, and error conditions
 */

import { logError } from './errorHandler';

export interface PollingConfig {
  baseInterval: number;
  maxInterval?: number;
  minInterval?: number;
  backoffMultiplier?: number;
  maxRetries?: number;
  enableVisibilityOptimization?: boolean;
  enableActivityOptimization?: boolean;
}

export interface PollingStats {
  currentInterval: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  isActive: boolean;
  isVisible: boolean;
}

export class AdaptivePoller {
  private config: Required<PollingConfig>;
  private stats: PollingStats;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;
  private lastActivityTime: number = Date.now();
  private visibilityChangeHandler?: () => void;
  private activityHandler?: () => void;
  private isRunning: boolean = false;
  private currentCallback?: () => Promise<void>;

  constructor(config: PollingConfig) {
    this.config = {
      baseInterval: config.baseInterval,
      maxInterval: config.maxInterval || config.baseInterval * 8,
      minInterval: config.minInterval || Math.max(config.baseInterval / 2, 1000),
      backoffMultiplier: config.backoffMultiplier || 1.5,
      maxRetries: config.maxRetries || 3,
      enableVisibilityOptimization: config.enableVisibilityOptimization ?? true,
      enableActivityOptimization: config.enableActivityOptimization ?? true
    };

    this.stats = {
      currentInterval: this.config.baseInterval,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      isActive: true,
      isVisible: !document.hidden
    };

    this.setupOptimizations();
  }

  /**
   * Setup page visibility and activity optimizations
   */
  private setupOptimizations(): void {
    if (this.config.enableVisibilityOptimization) {
      this.visibilityChangeHandler = () => {
        this.stats.isVisible = !document.hidden;
        this.adjustInterval();
      };
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    if (this.config.enableActivityOptimization) {
      this.activityHandler = () => {
        this.lastActivityTime = Date.now();
        if (!this.stats.isActive) {
          this.stats.isActive = true;
          this.adjustInterval();
        }
      };

      // Track user activity
      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, this.activityHandler!, { passive: true });
      });

      // Check for inactivity every minute
      setInterval(() => {
        const inactiveTime = Date.now() - this.lastActivityTime;
        const wasActive = this.stats.isActive;
        this.stats.isActive = inactiveTime < 5 * 60 * 1000; // 5 minutes

        if (wasActive !== this.stats.isActive) {
          this.adjustInterval();
        }
      }, 60000);
    }
  }

  /**
   * Calculate optimal polling interval based on current conditions
   */
  private calculateInterval(): number {
    let interval = this.config.baseInterval;

    // Apply backoff for consecutive failures
    if (this.stats.consecutiveFailures > 0) {
      interval *= Math.pow(this.config.backoffMultiplier, this.stats.consecutiveFailures);
    }

    // Slow down when page is hidden (if optimization enabled)
    if (this.config.enableVisibilityOptimization && !this.stats.isVisible) {
      interval *= 3;
    }

    // Slow down when user is inactive (if optimization enabled)
    if (this.config.enableActivityOptimization && !this.stats.isActive) {
      interval *= 2;
    }

    // Apply bounds
    interval = Math.max(this.config.minInterval, Math.min(this.config.maxInterval, interval));

    return Math.round(interval);
  }

  /**
   * Adjust polling interval based on current conditions
   */
  private adjustInterval(): void {
    const newInterval = this.calculateInterval();
    
    if (newInterval !== this.stats.currentInterval) {
      this.stats.currentInterval = newInterval;
      
      // Restart polling with new interval if currently running
      if (this.isRunning && this.currentCallback) {
        this.stop();
        this.start(this.currentCallback);
      }
    }
  }

  /**
   * Start polling with the provided callback
   */
  start(callback?: () => Promise<void>): void {
    if (this.intervalId) {
      this.stop();
    }

    if (!callback) {
      logError('ADAPTIVE_POLLER', new Error('No callback provided to start()'), {
        component: 'AdaptivePoller'
      });
      return;
    }

    this.currentCallback = callback;
    this.isRunning = true;
    this.abortController = new AbortController();
    
    const pollFunction = async () => {
      try {
        this.stats.totalRequests++;
        
        await callback();
        
        this.stats.successfulRequests++;
        this.stats.consecutiveFailures = 0;
        
        // Reset to base interval on success
        if (this.stats.currentInterval > this.config.baseInterval) {
          this.adjustInterval();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return; // Normal cancellation
        }
        
        this.stats.failedRequests++;
        this.stats.consecutiveFailures++;
        
        logError('ADAPTIVE_POLLER', error, {
          component: 'AdaptivePoller',
          operation: 'poll',
          metadata: {
            consecutiveFailures: this.stats.consecutiveFailures,
            currentInterval: this.stats.currentInterval
          }
        });
        
        // Adjust interval on failure
        this.adjustInterval();
      }
    };

    // Initial call
    pollFunction();
    
    // Setup interval
    this.intervalId = setInterval(pollFunction, this.stats.currentInterval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false;
    this.currentCallback = undefined;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Update polling configuration
   */
  updateConfig(newConfig: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.adjustInterval();
  }

  /**
   * Reset stats and consecutive failures
   */
  resetStats(): void {
    this.stats = {
      ...this.stats,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0
    };
    this.adjustInterval();
  }

  /**
   * Get current polling statistics
   */
  getStats(): PollingStats {
    return { ...this.stats };
  }

  /**
   * Get abort signal for current polling session
   */
  getAbortSignal(): AbortSignal | null {
    return this.abortController?.signal || null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    if (this.activityHandler) {
      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.removeEventListener(event, this.activityHandler!);
      });
    }
  }
}

/**
 * Hook for using adaptive polling in React components
 */
import { useEffect, useRef, useCallback } from 'react';

export const useAdaptivePolling = (
  callback: () => Promise<void>,
  config: PollingConfig,
  enabled: boolean = true
) => {
  const pollerRef = useRef<AdaptivePoller | null>(null);

  const startPolling = useCallback(() => {
    if (!pollerRef.current) {
      pollerRef.current = new AdaptivePoller(config);
    }
    if (callback) {
      pollerRef.current.start(callback);
    }
  }, [callback, config]);

  const stopPolling = useCallback(() => {
    pollerRef.current?.stop();
  }, []);

  const getStats = useCallback(() => {
    return pollerRef.current?.getStats() || null;
  }, []);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      pollerRef.current?.destroy();
      pollerRef.current = null;
    };
  }, [enabled, startPolling, stopPolling]);

  return {
    startPolling,
    stopPolling,
    getStats,
    isPolling: !!pollerRef.current?.getStats()?.totalRequests
  };
};
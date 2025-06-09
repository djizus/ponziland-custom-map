/**
 * Centralized error handling utility for consistent error logging and processing
 */

export interface ErrorContext {
  component?: string;
  function?: string;
  operation?: string;
  userId?: string;
  url?: string;
  key?: string;
  attempts?: number;
  attempt?: number;
  delay?: number;
  maxRetries?: number;
  quotaExceeded?: boolean;
  errorBoundary?: boolean;
  status?: number;
  method?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  message: string;
  status: number;
  context: string;
}

/**
 * Standardized error logging with context and metadata
 */
export const logError = (
  context: string, 
  error: unknown, 
  additionalContext?: ErrorContext
): void => {
  const timestamp = new Date().toISOString();
  const errorMessage = extractErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[${timestamp}] [${context}] ${errorMessage}`, {
    error,
    stack,
    ...additionalContext
  });
};

/**
 * Extract consistent error message from various error types
 */
export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  
  return 'Unknown error occurred';
};

/**
 * Handle API fetch errors with consistent formatting
 */
export const handleApiError = async (
  response: Response, 
  context: string
): Promise<ApiErrorResponse> => {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  
  try {
    const errorText = await response.text();
    if (errorText) {
      errorMessage = errorText;
    }
  } catch {
    // Keep the default HTTP error message if we can't read response
  }
  
  const apiError: ApiErrorResponse = {
    message: errorMessage,
    status: response.status,
    context
  };
  
  logError('API_ERROR', apiError, { url: response.url, status: response.status });
  
  return apiError;
};

/**
 * Standardized async operation wrapper with error handling
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: string,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    logError(context, error);
    return fallbackValue;
  }
};

/**
 * Handle localStorage operations with error handling
 */
export const safeLocalStorage = {
  getItem: (key: string, fallback: string = ''): string => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      logError('LOCALSTORAGE_GET', error, { key });
      return fallback;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logError('LOCALSTORAGE_SET', error, { key, quotaExceeded: error instanceof DOMException && error.code === 22 });
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logError('LOCALSTORAGE_REMOVE', error, { key });
      return false;
    }
  },
  
  parseJSON: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      logError('LOCALSTORAGE_PARSE', error, { key });
      return fallback;
    }
  }
};

/**
 * Error categories for consistent error classification
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION', 
  CALCULATION = 'CALCULATION',
  STORAGE = 'STORAGE',
  USER_INPUT = 'USER_INPUT',
  SYSTEM = 'SYSTEM'
}

/**
 * Create standardized error for specific categories
 */
export const createError = (
  category: ErrorCategory,
  message: string,
  originalError?: unknown
): Error => {
  const error = new Error(`[${category}] ${message}`);
  if (originalError) {
    // Store original error in a custom property since cause isn't available in older TS targets
    (error as any).originalError = originalError;
  }
  return error;
};

/**
 * Retry mechanism with exponential backoff
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'RETRY_OPERATION'
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        logError(`${context}_FINAL_FAILURE`, error, { attempts: maxRetries });
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logError(`${context}_RETRY`, error, { attempt, delay, maxRetries });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
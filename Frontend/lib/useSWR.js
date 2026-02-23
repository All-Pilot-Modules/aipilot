import useSWR, { useSWRConfig, mutate as globalMutate } from 'swr';
import { apiClient } from './auth';

/**
 * Custom SWR hook with automatic caching and request deduplication
 *
 * Benefits:
 * - Automatic caching (data is cached in memory)
 * - Request deduplication (multiple components requesting same data = 1 request)
 * - Automatic revalidation (refetch on window focus, reconnect)
 * - Optimistic UI updates
 * - Built-in loading and error states
 *
 * @param {string|null} key - API endpoint (e.g., '/api/modules?teacher_id=123')
 * @param {object} options - SWR configuration options
 * @returns {object} { data, error, isLoading, isValidating, mutate }
 */
export function useAPI(key, options = {}) {
  const fetcher = (url) => apiClient.get(url);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key, // Can be null to disable fetching
    fetcher,
    {
      // Default options - optimized for speed
      revalidateOnFocus: false, // Don't refetch when window gains focus (saves bandwidth)
      revalidateOnReconnect: true, // Refetch when internet reconnects
      dedupingInterval: 30000, // Dedupe requests within 30 seconds (stable data like modules/questions)
      focusThrottleInterval: 5000, // Throttle focus revalidation
      errorRetryCount: 3, // Retry failed requests 3 times
      errorRetryInterval: 5000, // Wait 5s between retries
      ...options, // Allow overrides
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating, // true when revalidating in background
    mutate, // Function to manually update cache or revalidate
  };
}

/**
 * Prefetch data to warm up the cache
 * Useful for prefetching next page, next question, etc.
 *
 * @param {string} key - API endpoint to prefetch
 */
export async function prefetchAPI(key) {
  try {
    const data = await apiClient.get(key);
    // Populate SWR cache so subsequent useAPI calls return instantly
    globalMutate(key, data, false);
    return data;
  } catch (error) {
    console.error('Prefetch failed:', error);
    return null;
  }
}

/**
 * Mutate multiple SWR caches at once
 * Useful for invalidating related data after mutations
 *
 * @param {string[]} keys - Array of cache keys to invalidate
 */
export function useMutateMultiple() {
  const { mutate } = useSWRConfig();
  return (keys) => {
    keys.forEach(key => mutate(key));
  };
}

// Export useSWRConfig for advanced usage
export { useSWRConfig } from 'swr';

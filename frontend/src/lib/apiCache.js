import axios from 'axios';

// In-memory cache: url -> { data, timestamp, promise }
const cache = new Map();
const DEFAULT_TTL = 60 * 1000; // 1 minute

/**
 * Perform a GET request with caching and in-flight request deduplication.
 *
 * @param {string} url - The URL to fetch.
 * @param {object} options - Configuration options.
 * @param {boolean} [options.forceRefresh=false] - Bypass and update cache.
 * @param {number} [options.ttl=60000] - Cache time-to-live in ms.
 * @returns {Promise<any>} The axios response object ({ data, status, ... }).
 */
export async function apiGet(url, options = {}) {
  const { forceRefresh = false, ttl = DEFAULT_TTL, ...axiosConfig } = options;
  const now = Date.now();
  const entry = cache.get(url);

  // 1. If not forcing refresh, return cached data if fresh
  if (!forceRefresh && entry && entry.data !== undefined) {
    if (now - entry.timestamp < ttl) {
      return { data: entry.data, fromCache: true };
    }
  }

  // 2. If an identical request is already in-flight, reuse its promise (deduplication)
  if (!forceRefresh && entry && entry.promise) {
    return entry.promise;
  }

  // 3. Initiate the network request
  const promise = axios.get(url, axiosConfig)
    .then((res) => {
      cache.set(url, {
        data: res.data,
        timestamp: Date.now(),
        promise: null,
      });
      return res;
    })
    .catch((err) => {
      // Clear in-flight promise on error so subsequent attempts can retry
      cache.delete(url);
      throw err;
    });

  // Store in-flight promise
  cache.set(url, {
    data: entry ? entry.data : undefined,
    timestamp: entry ? entry.timestamp : 0,
    promise,
  });

  return promise;
}

/**
 * Invalidate specific cached URL(s) or pattern, or clear all cache.
 * @param {string|RegExp|null} pattern - URL string or RegExp to invalidate. If null, clears entire cache.
 */
export function invalidateCache(pattern = null) {
  if (!pattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      cache.delete(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * Directly set or pre-populate cached data for a URL.
 */
export function setCache(url, data) {
  cache.set(url, {
    data,
    timestamp: Date.now(),
    promise: null,
  });
}

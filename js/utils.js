/* eslint no-unused-vars: "off" */
/* global chrome */
/* exported fetchUrl, getStorageData, setStorageData, clearStorageData, formatCurrency */
/**
 * General utility helpers for Keydrop+ extension.
 * Includes network and storage helpers reused across modules.
 */

/** Default timeout for network requests in milliseconds. */
const defaultFetchTimeout = 15 * 1000;

/** Simple in-memory cache for GET requests. */
const fetchCache = new Map();

/**
 * Perform a network request with optional authorization and body data.
 * Automatically appends a timestamp to bust caches unless `noTime` is true.
 *
 * @param {string} type HTTP method
 * @param {string} url Target URL
 * @param {string|false} token Optional bearer token
 * @param {boolean} noTime Skip timestamp parameter
 * @param {Object} [data] JSON body payload
 * @param {{timeout?:number, headers?:Object, cache?:number}} [options]
 *        Additional options including request timeout and cache duration
 *        (in ms) for GET requests.
 * @returns {Promise<*>} Parsed JSON/text response or null on error
 */
const fetchUrl = async (type, url, token, noTime, data, options = {}) => {
    const { timeout = defaultFetchTimeout, headers = {}, cache = 0 } = options;
    const cacheKey = `${type}:${url}:${JSON.stringify(data)}`;
    if (cache > 0 && type === 'GET') {
        const cached = fetchCache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < cache) {
            return cached.value;
        }
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const requestUrl = new URL(url);
        if (!noTime) requestUrl.searchParams.set('t', Date.now());
        const response = await fetch(requestUrl.toString(), {
            method: type,
            headers: {
                ...(data ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { authorization: `Bearer ${token}` } : {}),
                ...headers
            },
            body: data ? JSON.stringify(data) : undefined,
            signal: controller.signal
        });
        clearTimeout(timer);
        if (response.status === 403) {
            return window?.location?.reload();
        }
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || '';
        const value = contentType.includes('application/json')
            ? await response.json()
            : await response.text();
        if (cache > 0 && type === 'GET') {
            fetchCache.set(cacheKey, { time: Date.now(), value });
        }
        return value;
    } catch (e) {
        return null;
    }
};

/**
 * Retrieve a value from browser storage.
 *
 * @param {'local'|'sync'|0|1} type Storage type
 * @param {string} name Key name
 * @param {*} [defaultValue] Value to return if key does not exist
 * @returns {Promise<*>} Stored value or defaultValue
 */
const getStorageData = async (type, name, defaultValue) => {
    try {
        const storage = (type === 'local' || type === 0) ? chrome.storage.local : chrome.storage.sync;
        const result = await storage.get([name]);
        return result[name] ?? defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

/**
 * Save data to browser storage.
 *
 * @param {'local'|'sync'|0|1} type Storage type
 * @param {Object} data Data to store
 * @returns {Promise<boolean>} True on success
 */
const setStorageData = async (type, data) => {
    try {
        const storage = (type === 'local' || type === 0) ? chrome.storage.local : chrome.storage.sync;
        await storage.set(data);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Clear all data from a storage area.
 *
 * @param {'local'|'sync'|0|1} type Storage type
 * @returns {Promise<boolean>} True on success
 */
const clearStorageData = async (type) => {
    try {
        const storage = (type === 'local' || type === 0) ? chrome.storage.local : chrome.storage.sync;
        await storage.clear();
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Format a numeric value as a currency string.
 *
 * @param {number} value Numeric value to format
 * @param {string} currency ISO currency code
 * @param {string} [locale='en-US'] Locale for formatting
 * @returns {string} Formatted currency string
 */
const formatCurrency = (value, currency, locale = 'en-US') => {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
};


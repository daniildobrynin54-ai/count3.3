// Optimized utility functions
import { CONFIG, CARD_ID_PREFIX, ERROR_TYPES } from './config.js';
import { Logger } from './logger.js';

/**
 * Card ID resolver with caching and error handling
 */
class CardIdResolver {
    constructor() {
        this.cache = new Map();
        this.pending = new Map();
        this.maxCacheSize = 1000;
    }

    /**
     * Resolve card ID with automatic cache cleanup
     */
    async resolve(idWithPrefix) {
        // Check cache first
        if (this.cache.has(idWithPrefix)) {
            return this.cache.get(idWithPrefix);
        }

        // Check if resolution is already in progress
        if (this.pending.has(idWithPrefix)) {
            return this.pending.get(idWithPrefix);
        }

        // Start new resolution
        const promise = this._resolveCardId(idWithPrefix);
        this.pending.set(idWithPrefix, promise);

        try {
            const result = await promise;
            this._addToCache(idWithPrefix, result);
            return result;
        } finally {
            this.pending.delete(idWithPrefix);
        }
    }

    async _resolveCardId(idWithPrefix) {
        if (idWithPrefix.startsWith(CARD_ID_PREFIX.MARKET)) {
            const lotId = idWithPrefix.replace(CARD_ID_PREFIX.MARKET, '');
            return this._fetchCardIdFromPage(CONFIG.API.MARKET_LOT(lotId), 'lot', lotId);
        }

        if (idWithPrefix.startsWith(CARD_ID_PREFIX.REQUEST)) {
            const requestId = idWithPrefix.replace(CARD_ID_PREFIX.REQUEST, '');
            return this._fetchCardIdFromPage(CONFIG.API.MARKET_REQUEST(requestId), 'request', requestId);
        }

        return idWithPrefix;
    }

    async _fetchCardIdFromPage(url, type, id) {
        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': navigator.userAgent
                },
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const wrapper = doc.querySelector('.card-show__wrapper');

            if (!wrapper) {
                throw new Error('Card wrapper not found');
            }

            const cardLink = wrapper.querySelector(CONFIG.SELECTORS.CARD_LINK);
            if (!cardLink) {
                throw new Error('Card link not found');
            }

            const match = cardLink.href.match(/\/cards\/(\d+)\/users/);
            if (!match) {
                throw new Error('Card ID not found in link');
            }

            Logger.info(`Resolved ${type} ${id} → Card ${match[1]}`);
            return match[1];

        } catch (error) {
            Logger.error(`Failed to resolve ${type} ${id}:`, error);
            return null;
        }
    }

    _addToCache(key, value) {
        // Implement LRU cache behavior
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
        this.pending.clear();
    }

    getStats() {
        return {
            cacheSize: this.cache.size,
            pendingCount: this.pending.size
        };
    }
}

/**
 * DOM utilities with performance optimizations
 */
export const DOMUtils = {
    /**
     * Get card ID from element with various fallback strategies
     */
    getCardId(cardElem) {
        if (!cardElem) return null;

        // Special handling for requests page
        if (this._isRequestsPage()) {
            const requestId = this._getRequestId(cardElem);
            if (requestId) {
                return `${CARD_ID_PREFIX.REQUEST}${requestId}`;
            }
        }

        // Special handling for market page (my lots)
        if (this._isMarketPage()) {
            const lotId = this._getMarketLotId(cardElem);
            if (lotId) {
                return `${CARD_ID_PREFIX.MARKET}${lotId}`;
            }
        }

        // Standard card ID extraction
        return this._extractStandardCardId(cardElem);
    },

    _isRequestsPage() {
        const path = location.pathname;
        return path === '/market/requests' || path.startsWith('/market/requests');
    },

    _isMarketPage() {
        return location.pathname === '/market';
    },

    _getRequestId(cardElem) {
        const wrapper = cardElem.closest('.manga-cards__item-wrapper');
        if (wrapper?.closest('.market-list__cards--requests')) {
            return wrapper.getAttribute('data-id');
        }
        return null;
    },

    _getMarketLotId(cardElem) {
        const wrapper = cardElem.closest('.manga-cards__item-wrapper');
        if (wrapper?.closest('.market-list__cards--my')) {
            return wrapper.getAttribute('data-id');
        }
        return null;
    },

    _extractStandardCardId(cardElem) {
        // Try direct link first
        if (cardElem.tagName === 'A' && cardElem.href) {
            const match = cardElem.href.match(/\/cards\/(\d+)\/users/);
            if (match) return match[1];
        }

        // Try child link
        const link = cardElem.querySelector('a[href*="/cards/"][href*="/users"]');
        if (link) {
            const match = link.href.match(/\/cards\/(\d+)\/users/);
            if (match) return match[1];
        }

        // Try data attributes
        const dataAttrs = ['data-card-id', 'data-id', 'data-card', 'data-item-id'];
        for (const attr of dataAttrs) {
            const value = cardElem.getAttribute?.(attr);
            if (value) return value;

            const parent = cardElem.closest?.(`[${attr}]`);
            if (parent) {
                const parentValue = parent.getAttribute(attr);
                if (parentValue) return parentValue;
            }

            const child = cardElem.querySelector?.(`[${attr}]`);
            if (child) {
                const childValue = child.getAttribute(attr);
                if (childValue) return childValue;
            }
        }

        // Try any card link
        const anyLink = cardElem.querySelector('a[href*="/cards/"]');
        if (anyLink) {
            const match = anyLink.href.match(/\/cards\/(\d+)(?:\/|$)/);
            if (match) return match[1];
        }

        // Try direct link without /users
        if (cardElem.tagName === 'A' && cardElem.href) {
            const match = cardElem.href.match(/\/cards\/(\d+)(?:\/|$)/);
            if (match) return match[1];
        }

        return null;
    },

    /**
     * Parse page numbers from pagination
     */
    parsePageNumbers(doc) {
        const pageElements = doc.querySelectorAll(CONFIG.SELECTORS.PAGINATION);
        const pages = Array.from(pageElements)
            .map(el => parseInt(el.textContent.trim(), 10))
            .filter(num => !isNaN(num) && num > 0);
        
        return pages.length > 0 ? Math.max(...pages) : 1;
    },

    /**
     * Check if element is in viewport (for lazy loading)
     */
    isInViewport(element, offset = 200) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= -offset &&
            rect.left >= -offset &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + offset &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) + offset
        );
    },

    /**
     * Batch DOM queries for better performance
     */
    queryAllCards() {
        const allNodes = [];
        const seenNodes = new Set();

        for (const selector of CONFIG.CARD_SELECTORS) {
            try {
                const nodes = document.querySelectorAll(selector);
                for (const node of nodes) {
                    if (!seenNodes.has(node)) {
                        seenNodes.add(node);
                        allNodes.push(node);
                    }
                }
            } catch (e) {
                Logger.warn(`Invalid selector: ${selector}`, e);
            }
        }

        return allNodes;
    }
};

/**
 * General utilities
 */
export const Utils = {
    /**
     * Sleep with cancellation support
     */
    sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, ms);
            
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new Error('Sleep aborted'));
                });
            }
        });
    },

    /**
     * Debounce function with immediate execution option
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Retry with exponential backoff
     */
    async retry(fn, options = {}) {
        const {
            maxAttempts = CONFIG.MAX_RETRIES,
            baseDelay = 1000,
            maxDelay = 10000,
            onRetry = null
        } = options;

        let lastError;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts - 1) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                    
                    if (onRetry) {
                        onRetry(attempt + 1, maxAttempts, delay, error);
                    }
                    
                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    },

    /**
     * Current timestamp
     */
    now() {
        return Date.now();
    },

    /**
     * Format number with K/M suffix
     */
    formatNumber(num) {
        if (typeof num !== 'number' || num < 0) return num;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    /**
     * Safe JSON parse with fallback
     */
    safeJsonParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            Logger.warn('JSON parse error:', e);
            return fallback;
        }
    },

    /**
     * Safe JSON stringify
     */
    safeJsonStringify(obj, fallback = '{}') {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            Logger.warn('JSON stringify error:', e);
            return fallback;
        }
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
};

// Create singleton resolver instance
export const CardIdResolver_Instance = new CardIdResolver();
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

    async resolve(idWithPrefix) {
        if (this.cache.has(idWithPrefix)) {
            return this.cache.get(idWithPrefix);
        }

        if (this.pending.has(idWithPrefix)) {
            return this.pending.get(idWithPrefix);
        }

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

        // ===== FIX: Special handling for trade__main-item =====
        // Try trade-specific resolution first, but fall through to standard
        // extraction if it fails (e.g. on view-only trade pages where <a>
        // elements have a href but no data-id attribute).
        if (cardElem.classList.contains('trade__main-item')) {
            const tradeCardId = this._getTradeMainItemCardId(cardElem);
            if (tradeCardId) return tradeCardId;
            // Fall through to standard extraction below
        }

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

    /**
     * FIX: Resolve card ID for .trade__main-item elements.
     *
     * On trade-CREATION pages the element has data-id = instance ID and we
     * must look up the matching inventory card.
     *
     * On trade-VIEW pages (/trades/<id>) the element is an <a> tag whose href
     * already contains /cards/<id>/users — we just extract it directly.
     *
     * Fallback chain:
     *   1. href on the <a> element itself  ← NEW (covers view pages)
     *   2. Inventory card lookup via data-id → data-card-id  ← trade creation
     *   3. data-card-id directly on element
     *   4. data-id on child .lock-card-btn  ← NEW fallback
     */
    _getTradeMainItemCardId(cardElem) {
        // 1. BEST: href directly on the element (view-only trade pages)
        //    e.g. <a href="/cards/243465/users" class="trade__main-item">
        if (cardElem.tagName === 'A' && cardElem.href) {
            const match = cardElem.href.match(/\/cards\/(\d+)\/users/);
            if (match) {
                Logger.info(`trade__main-item: card-id ${match[1]} (from href)`);
                return match[1];
            }
        }

        // 2. Trade-creation pages: data-id on the element = instance ID,
        //    look it up in the inventory panel to get the real card-id.
        const instanceId = cardElem.getAttribute('data-id');
        if (instanceId) {
            const inventoryCard = document.querySelector(
                `.card-filter-list__card[data-id="${instanceId}"]`
            );
            if (inventoryCard) {
                const cardId = inventoryCard.getAttribute('data-card-id');
                if (cardId) {
                    Logger.info(`trade__main-item ${instanceId} → card-id ${cardId} (from inventory)`);
                    return cardId;
                }
            }

            // 3. Maybe the element itself has data-card-id
            const directCardId = cardElem.getAttribute('data-card-id');
            if (directCardId) {
                Logger.info(`trade__main-item ${instanceId} → card-id ${directCardId} (direct)`);
                return directCardId;
            }

            Logger.warn(`trade__main-item ${instanceId}: could not resolve to card-id. ` +
                        `Inventory card not found in DOM yet.`);
        }

        // 4. Fallback: data-id on the child .lock-card-btn is an INSTANCE id,
        //    not a card definition id — skip it to avoid wrong lookups.
        //    Instead try any /cards/<id> link inside the element.
        const innerLink = cardElem.querySelector('a[href*="/cards/"]');
        if (innerLink) {
            const match = innerLink.href.match(/\/cards\/(\d+)/);
            if (match) {
                Logger.info(`trade__main-item: card-id ${match[1]} (from inner link)`);
                return match[1];
            }
        }

        return null;
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

        // Try data attributes — prefer data-card-id over data-id
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

    now() {
        return Date.now();
    },

    formatNumber(num) {
        if (typeof num !== 'number' || num < 0) return num;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    },

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

    safeJsonParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            Logger.warn('JSON parse error:', e);
            return fallback;
        }
    },

    safeJsonStringify(obj, fallback = '{}') {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            Logger.warn('JSON stringify error:', e);
            return fallback;
        }
    },

    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
};

// Create singleton resolver instance
export const CardIdResolver_Instance = new CardIdResolver();
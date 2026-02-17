// Optimized HTTP client with better error handling and retry logic
import { CONFIG, ERROR_TYPES } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { RateLimitTracker } from './rate-limit.js';
import { NotificationManager } from './notification.js';

class HTTPError extends Error {
    constructor(message, status, type) {
        super(message);
        this.name = 'HTTPError';
        this.status = status;
        this.type = type;
    }
}

export class HttpClient {
    static activeRequests = new Set();
    static requestQueue = [];
    static isProcessingQueue = false;

    static async makeRequest(url, options = {}) {
        const {
            skipRateLimit = false,
            retries = CONFIG.MAX_RETRIES,
            timeout = CONFIG.REQUEST_TIMEOUT,
            priority = false
        } = options;

        if (!skipRateLimit) {
            await RateLimitTracker.waitForSlot();
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                if (!skipRateLimit) {
                    await RateLimitTracker.addRequest();
                }

                const requestId = Utils.generateId();
                this.activeRequests.add(requestId);

                const response = await fetch(url, {
                    signal: controller.signal,
                    credentials: 'include',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml',
                        'User-Agent': navigator.userAgent
                    }
                });

                clearTimeout(timeoutId);
                this.activeRequests.delete(requestId);

                if (response.ok) {
                    const text = await response.text();
                    return { 
                        responseText: text, 
                        status: response.status,
                        ok: true 
                    };
                }

                if (response.status === 429) {
                    throw new HTTPError('Rate limit exceeded', 429, ERROR_TYPES.RATE_LIMIT);
                }

                if (response.status === 404) {
                    throw new HTTPError('Not found', 404, ERROR_TYPES.NOT_FOUND);
                }

                throw new HTTPError(`HTTP ${response.status}`, response.status, ERROR_TYPES.NETWORK);

            } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                    throw new HTTPError('Request timeout', 0, ERROR_TYPES.TIMEOUT);
                }

                throw error;
            }

        } catch (error) {
            if (error.type === ERROR_TYPES.RATE_LIMIT) {
                return this._handle429Error(url, options);
            }

            if (error.type === ERROR_TYPES.NETWORK && options._retryCount < retries) {
                return this._retryRequest(url, options);
            }

            throw error;
        }
    }

    static async _handle429Error(url, options) {
        const attempt429 = (options._attempt429 || 0) + 1;

        if (attempt429 > CONFIG.RETRY_429_MAX_ATTEMPTS) {
            throw new HTTPError(
                'Max 429 retry attempts exceeded',
                429,
                ERROR_TYPES.RATE_LIMIT
            );
        }

        const delay = CONFIG.RETRY_429_DELAY * attempt429;
        
        Logger.important(
            `⚠️ Rate limit (429), retry ${attempt429}/${CONFIG.RETRY_429_MAX_ATTEMPTS} after ${delay}ms`
        );

        NotificationManager.show429Error(
            Math.ceil(delay / 1000),
            attempt429,
            CONFIG.RETRY_429_MAX_ATTEMPTS
        );

        await Utils.sleep(delay);

        return this.makeRequest(url, {
            ...options,
            _attempt429: attempt429
        });
    }

    static async _retryRequest(url, options) {
        const retryCount = (options._retryCount || 0) + 1;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

        Logger.warn(`Retrying request (${retryCount}/${CONFIG.MAX_RETRIES}) after ${delay}ms`);
        
        await Utils.sleep(delay);

        return this.makeRequest(url, {
            ...options,
            _retryCount: retryCount
        });
    }

    static async batchRequest(urls, options = {}) {
        const {
            concurrency = CONFIG.BATCH_SIZE,
            onProgress = null,
            skipRateLimit = false
        } = options;

        const results = [];
        const errors = [];

        for (let i = 0; i < urls.length; i += concurrency) {
            const batch = urls.slice(i, i + concurrency);
            
            const batchPromises = batch.map(async (url, index) => {
                try {
                    const result = await this.makeRequest(url, { skipRateLimit });
                    results[i + index] = result;
                    
                    if (onProgress) {
                        onProgress(i + index + 1, urls.length);
                    }
                    
                    return result;
                } catch (error) {
                    errors.push({ url, error, index: i + index });
                    results[i + index] = null;
                    return null;
                }
            });

            await Promise.all(batchPromises);

            if (i + concurrency < urls.length) {
                await Utils.sleep(CONFIG.PAUSE_BETWEEN_REQUESTS);
            }
        }

        return {
            results,
            errors,
            successCount: results.filter(r => r !== null).length,
            errorCount: errors.length
        };
    }

    static cancelAllRequests() {
        Logger.important(`Cancelling ${this.activeRequests.size} active requests`);
        this.activeRequests.clear();
    }

    static getActiveRequestCount() {
        return this.activeRequests.size;
    }

    static parseHTML(responseText) {
        try {
            return new DOMParser().parseFromString(responseText, 'text/html');
        } catch (error) {
            throw new HTTPError('Failed to parse HTML', 0, ERROR_TYPES.PARSE);
        }
    }

    static async fetchAndParse(url, options = {}) {
        const response = await this.makeRequest(url, options);
        return this.parseHTML(response.responseText);
    }

    static getStats() {
        return {
            activeRequests: this.activeRequests.size,
            queuedRequests: this.requestQueue.length
        };
    }
}

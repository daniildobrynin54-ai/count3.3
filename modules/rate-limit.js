// Rate Limit Tracker with optimizations
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { storageGet, storageSet } from './storage.js';
import { Utils } from './utils.js';
import { NotificationManager } from './notification.js';

export class RateLimitTracker {
    static requests = [];
    static initialized = false;

    static async init() {
        if (this.initialized) return;
        
        try {
            const stored = await storageGet(CONFIG.RATE_LIMIT_KEY, []);
            this.requests = Array.isArray(stored) ? stored : [];
            this.cleanup();
            await this.persist();
            this.initialized = true;
            Logger.info(`RateLimitTracker initialized: ${this.requests.length} requests in history`);
        } catch (e) {
            Logger.warn('RateLimitTracker init error:', e);
            this.requests = [];
            this.initialized = true;
        }
    }

    static async addRequest() {
        const now = Date.now();
        this.requests.push(now);
        this.cleanup();
        await this.persist();
    }

    static cleanup() {
        const now = Date.now();
        const cutoff = now - CONFIG.RATE_LIMIT_WINDOW;
        this.requests = this.requests.filter(time => time > cutoff);
    }

    static async persist() {
        try {
            await storageSet(CONFIG.RATE_LIMIT_KEY, this.requests);
        } catch (e) {
            Logger.warn('RateLimitTracker persist error:', e);
        }
    }

    static getRequestsInWindow() {
        this.cleanup();
        return this.requests.length;
    }

    static canMakeRequest() {
        return this.getRequestsInWindow() < CONFIG.MAX_REQUESTS_PER_MINUTE;
    }

    static async waitForSlot() {
        while (!this.canMakeRequest()) {
            const oldest = this.requests[0];
            if (!oldest) {
                Logger.warn('Rate limit inconsistency, resetting...');
                this.requests = [];
                await this.persist();
                break;
            }
            
            const waitTime = oldest + CONFIG.RATE_LIMIT_WINDOW - Date.now() + 1000;
            const waitSeconds = Math.ceil(waitTime / 1000);
            
            Logger.important(`⏳ Rate limit: ${this.getRequestsInWindow()}/${CONFIG.MAX_REQUESTS_PER_MINUTE}, waiting ${waitSeconds}s`);
            
            NotificationManager.showRateLimitWarning(waitSeconds);
            
            await Utils.sleep(Math.max(waitTime, 1000));
            this.cleanup();
        }
    }

    static getStats() {
        const now = Date.now();
        const inWindow = this.getRequestsInWindow();
        const oldest = this.requests[0];
        const timeUntilReset = oldest ? Math.ceil((oldest + CONFIG.RATE_LIMIT_WINDOW - now) / 1000) : 0;
        
        return {
            current: inWindow,
            max: CONFIG.MAX_REQUESTS_PER_MINUTE,
            remaining: CONFIG.MAX_REQUESTS_PER_MINUTE - inWindow,
            resetIn: timeUntilReset > 0 ? timeUntilReset : 0
        };
    }

    static async forceReset() {
        Logger.important('🔄 Force resetting rate limit tracker');
        this.requests = [];
        await this.persist();
    }
}
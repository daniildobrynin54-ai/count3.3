// Page Filter Manager with optimized patterns
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { storageGet, storageSet } from './storage.js';

export class PageFilter {
    static filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };

    static async load() {
        try {
            const stored = await storageGet(CONFIG.PAGE_FILTERS_KEY, null);
            if (stored && typeof stored === 'object') {
                this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS, ...stored };
            } else {
                this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };
            }
            Logger.info('Page filters loaded:', this.filters);
        } catch (e) {
            Logger.warn('PageFilter load error:', e);
            this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };
        }
    }

    static async save() {
        try {
            await storageSet(CONFIG.PAGE_FILTERS_KEY, this.filters);
            Logger.info('Page filters saved');
        } catch (e) {
            Logger.warn('PageFilter save error:', e);
        }
    }

    static async setFilter(filterName, enabled) {
        if (this.filters.hasOwnProperty(filterName)) {
            this.filters[filterName] = enabled;
            await this.save();
            Logger.important(`Page filter "${filterName}" set to ${enabled}`);
            return true;
        }
        return false;
    }

    static getFilters() {
        return { ...this.filters };
    }

    static getCurrentPageType() {
        const path = location.pathname;
        
        // Use precompiled patterns from CONFIG
        for (const [type, pattern] of Object.entries(CONFIG.PAGE_PATTERNS)) {
            if (pattern.test(path)) {
                return type;
            }
        }
        
        return 'other';
    }

    static isCurrentPageEnabled() {
        const pageType = this.getCurrentPageType();
        const enabled = this.filters[pageType];
        
        Logger.debug(`Page: ${pageType}, enabled: ${enabled}`);
        return enabled;
    }

    static getPageTypeLabel(pageType) {
        const labels = {
            packOpening: '🎴 Открытие паков',
            marketLots: '🏪 Маркет (главная)',
            marketLotPage: '📦 Страница лота',
            marketRequests: '📋 Заявки',
            marketRequestCreate: '✍️ Создание заявки',
            userCards: '👤 Карты пользователя',
            userShowcase: '🏆 Витрина',
            tradeCreatePages: '✨ Создание обмена',
            tradePages: '🔄 Обмены',
            deckPages: '📚 Колоды',
            cardShowPage: '🃏 Страница карты',
            other: '🌐 Остальное'
        };
        return labels[pageType] || pageType;
    }
}

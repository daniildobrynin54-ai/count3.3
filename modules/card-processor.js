// Optimized Card Processor with improved batch processing and priority queue + Wishlist support
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils, DOMUtils, CardIdResolver_Instance } from './utils.js';
import { Cache } from './cache.js';
import { StatsBadge } from './stats-badge.js';
import { OwnersCounter, WantsCounter } from './counters.js';
import { ExtensionState } from './extension-state.js';
import { PageFilter } from './page-filter.js';
import { Wishlist } from './wishlist.js';  // ДОБАВЛЕНО

/**
 * Priority levels for card processing
 */
const PRIORITY = {
    ERROR: 3,      // Highest - cards with errors
    NEW: 2,        // Medium - new cards not in cache
    EXPIRED: 1     // Lowest - expired cards
};

/**
 * Card item for processing queue
 */
class CardItem {
    constructor(element, cardId, priority = PRIORITY.NEW) {
        this.element = element;
        this.cardId = cardId;
        this.priority = priority;
        this.timestamp = Date.now();
    }
}

/**
 * Batch processor with cancellation support
 */
class BatchProcessor {
    constructor() {
        this.currentBatchUrl = null;
        this.cancelled = false;
        this.abortController = null;
        this.progress = { current: 0, total: 0 };
    }

    start(url) {
        this.currentBatchUrl = url;
        this.cancelled = false;
        this.abortController = new AbortController();
        this.progress = { current: 0, total: 0 };
    }

    cancel() {
        this.cancelled = true;
        if (this.abortController) {
            this.abortController.abort();
        }
        Logger.important('❌ Batch processing cancelled');
    }

    isCancelled() {
        return this.cancelled || location.href !== this.currentBatchUrl;
    }

    updateProgress(current, total) {
        this.progress = { current, total };
    }

    getProgress() {
        return { ...this.progress };
    }
}

export class CardProcessor {
    static batchProcessor = new BatchProcessor();
    static processedInSession = new Set();
    static processingQueue = [];
    static isProcessing = false;
    static cardIdMap = new Map(); // Карта элемент -> ID карты для отслеживания изменений

    /**
     * Main processing entry point
     */
    static async processAll() {
        if (!ExtensionState.isEnabled()) {
            Logger.info('Extension disabled, skipping');
            return;
        }

        if (!PageFilter.isCurrentPageEnabled()) {
            Logger.important(`⛔ Page type disabled: ${PageFilter.getCurrentPageType()}`);
            return;
        }

        // Start new batch
        this.batchProcessor.start(location.href);

        // Find all cards
        const cards = DOMUtils.queryAllCards();
        Logger.important(`🔍 Found ${cards.length} cards`);

        if (cards.length === 0) return;

        // Categorize cards by priority
        const queues = {
            [PRIORITY.ERROR]: [],
            [PRIORITY.NEW]: [],
            [PRIORITY.EXPIRED]: []
        };

        // Process each card and categorize
        for (const cardElem of cards) {
            const result = await this._categorizeCard(cardElem);
            if (result) {
                queues[result.priority].push(result.item);
            }
        }

        // Log queue sizes
        Logger.important(
            `🎯 Queues - ERRORS: ${queues[PRIORITY.ERROR].length}, ` +
            `NEW: ${queues[PRIORITY.NEW].length}, ` +
            `EXPIRED: ${queues[PRIORITY.EXPIRED].length}`
        );

        // Process in priority order
        for (const priority of [PRIORITY.ERROR, PRIORITY.NEW, PRIORITY.EXPIRED]) {
            const queue = queues[priority];
            if (queue.length > 0 && !this.batchProcessor.isCancelled()) {
                const label = priority === PRIORITY.ERROR ? 'ERROR' :
                             priority === PRIORITY.NEW ? 'NEW' : 'EXPIRED';
                Logger.important(`🔥 Processing ${label} cards...`);
                await this._processBatch(queue, priority);
            }
        }

        this.batchProcessor.updateProgress(0, 0);
    }

    /**
     * Categorize single card
     */
    static async _categorizeCard(cardElem) {
        let cardId = DOMUtils.getCardId(cardElem);
        if (!cardId) return null;

        // Resolve special card IDs (market/request)
        cardId = await CardIdResolver_Instance.resolve(cardId);
        if (!cardId) return null;

        // Проверяем, изменился ли ID карты (важно для страницы паков)
        const oldCardId = this.cardIdMap.get(cardElem);
        if (oldCardId && oldCardId !== cardId) {
            Logger.info(`🔄 Card ID changed: ${oldCardId} → ${cardId}`);
            // Сбрасываем флаг обработки для этой карты
            cardElem.classList.remove('mb_processed');
            cardElem.removeAttribute('data-mb-processed');
            // Удаляем старый бейдж и звездочку
            const oldBadge = cardElem.querySelector('.mbuf_card_overlay');
            if (oldBadge) oldBadge.remove();
            const oldStar = cardElem.querySelector('.mbuf_wishlist_star');
            if (oldStar) oldStar.remove();
        }

        // Сохраняем текущий ID
        this.cardIdMap.set(cardElem, cardId);

        // ПРОВЕРКА WISHLIST
        const isInWishlist = Wishlist.has(cardId);

        const cached = Cache.get(cardId);

        if (cached) {
            const isError = Cache.hasError(cached);
            const isExpired = Cache.isExpired(cached);
            const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);

            // Show cached data immediately WITH WISHLIST CHECK
            StatsBadge.update(
                cardElem,
                cached.owners,
                cached.wants,
                isExpired,
                isManuallyUpdated,
                isInWishlist  // ДОБАВЛЕНО
            );

            cardElem.classList.add('mb_processed');
            cardElem.setAttribute('data-mb-processed', 'true');

            // Determine priority
            if (isError) {
                return {
                    item: new CardItem(cardElem, cardId, PRIORITY.ERROR),
                    priority: PRIORITY.ERROR
                };
            } else if (isExpired) {
                return {
                    item: new CardItem(cardElem, cardId, PRIORITY.EXPIRED),
                    priority: PRIORITY.EXPIRED
                };
            }

            return null; // Valid cached data, no need to process
        }

        // Not in cache - но показываем wishlist звездочку если карта в списке
        if (!cardElem.classList.contains('mb_processed')) {
            if (isInWishlist) {
                StatsBadge.updateWishlistStar(cardElem, true);
            }
            return {
                item: new CardItem(cardElem, cardId, PRIORITY.NEW),
                priority: PRIORITY.NEW
            };
        }

        return null;
    }

    /**
     * Process batch of cards
     */
    static async _processBatch(items, priority) {
        const batchSize = CONFIG.BATCH_SIZE;
        const isRefresh = priority === PRIORITY.EXPIRED;

        this.batchProcessor.updateProgress(0, items.length);

        for (let i = 0; i < items.length; i += batchSize) {
            if (this.batchProcessor.isCancelled()) {
                Logger.important('⚠️ Batch cancelled');
                return;
            }

            const batch = items.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(items.length / batchSize);

            Logger.info(`Processing batch ${batchNum}/${totalBatches}`);

            // Process batch in parallel
            await Promise.all(
                batch.map((item, idx) => {
                    // Check if element still in DOM
                    if (!document.body.contains(item.element)) {
                        Logger.info(`Card ${item.cardId} removed from DOM`);
                        return Promise.resolve();
                    }

                    this.batchProcessor.updateProgress(i + idx + 1, items.length);
                    return this._processCard(item.element, item.cardId, isRefresh, false);
                })
            );

            // Pause between batches
            if (i + batchSize < items.length) {
                await Utils.sleep(
                    CONFIG.PAUSE_BETWEEN_REQUESTS,
                    this.batchProcessor.abortController?.signal
                ).catch(() => {});
            }
        }
    }

    /**
     * Process single card
     */
    static async _processCard(cardElem, cardId, isRefresh = false, forceAccurate = false) {
        if (!cardElem || !cardId) return;

        // Check if still in DOM
        if (!document.body.contains(cardElem)) {
            Logger.info(`Card ${cardId} not in DOM`);
            return;
        }

        // Check if already being fetched
        if (Cache.pendingFetches.has(cardId)) {
            try {
                const result = await Cache.pendingFetches.get(cardId);
                const cached = Cache.get(cardId);
                const isManuallyUpdated = cached ? Cache.isRecentlyManuallyUpdated(cached) : false;
                const isInWishlist = Wishlist.has(cardId); // ПРОВЕРКА WISHLIST
                StatsBadge.update(cardElem, result.owners, result.wants, false, isManuallyUpdated, isInWishlist);
            } catch (error) {
                Logger.error(`Error waiting for pending fetch ${cardId}:`, error);
            }
            return;
        }

        // Mark as processed
        cardElem.classList.add('mb_processed');
        cardElem.setAttribute('data-mb-processed', 'true');

        // ПРОВЕРКА WISHLIST ПЕРЕД ЗАГРУЗКОЙ
        const isInWishlist = Wishlist.has(cardId);

        // Show loading state for new cards
        if (!isRefresh) {
            StatsBadge.update(cardElem, '⌛', '⌛', false, false, isInWishlist);
        } else {
            // При рефреше тоже показываем звездочку если карта в wishlist
            const cached = Cache.get(cardId);
            if (cached) {
                const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);
                StatsBadge.update(cardElem, cached.owners, cached.wants, true, isManuallyUpdated, isInWishlist);
            }
        }

        try {
            // Create fetch promise
            const fetchPromise = Promise.all([
                OwnersCounter.count(cardId, forceAccurate, false),
                WantsCounter.count(cardId, forceAccurate, false)
            ]).then(([owners, wants]) => {
                Cache.set(cardId, owners, wants, forceAccurate);
                return { owners, wants };
            });

            // Store pending fetch
            Cache.pendingFetches.set(cardId, fetchPromise);

            // Wait for result
            const { owners, wants } = await fetchPromise;

            // Check if still in DOM
            if (!document.body.contains(cardElem)) {
                Logger.info(`Card ${cardId} removed during processing`);
                return;
            }

            // Update badge with wishlist check
            const cached = Cache.get(cardId);
            const isManuallyUpdated = cached ? Cache.isRecentlyManuallyUpdated(cached) : false;
            StatsBadge.update(cardElem, owners, wants, false, isManuallyUpdated, isInWishlist);

            Logger.important(`✅ Card ${cardId}: 👥${owners} ⭐${wants}${isInWishlist ? ' 🌟WISHLIST' : ''}`);

        } catch (error) {
            Logger.error(`Error processing card ${cardId}:`, error);

            // Update with error state
            if (document.body.contains(cardElem)) {
                StatsBadge.update(cardElem, -1, -1, false, false, isInWishlist);
            }

            Cache.set(cardId, -1, -1);

        } finally {
            Cache.pendingFetches.delete(cardId);
        }
    }

    /**
     * Priority update for manual click
     */
    static async priorityUpdateCard(cardElem, cardIdRaw) {
        if (!ExtensionState.isEnabled()) {
            Logger.important('Extension disabled');
            return;
        }

        // Resolve card ID
        const cardId = await CardIdResolver_Instance.resolve(cardIdRaw);
        if (!cardId) {
            Logger.error(`Failed to resolve card ID: ${cardIdRaw}`);
            return;
        }

        Logger.important(`🎯 Manual update (PRIORITY): Card ${cardId}`);

        // ПРОВЕРКА WISHLIST
        const isInWishlist = Wishlist.has(cardId);

        // Show loading state
        const badge = cardElem.querySelector('.mbuf_card_overlay');
        if (badge) {
            StatsBadge.render(badge, '⌛', '⌛', false, true);
        }
        // Сохраняем звездочку если есть
        if (isInWishlist) {
            StatsBadge.updateWishlistStar(cardElem, true);
        }

        try {
            // Fetch with priority (skip rate limit)
            const [owners, wants] = await Promise.all([
                OwnersCounter.count(cardId, true, true),
                WantsCounter.count(cardId, true, true)
            ]);

            // Save with manual update flag
            Cache.set(cardId, owners, wants, true);

            // Update badge WITH WISHLIST
            StatsBadge.update(cardElem, owners, wants, false, true, isInWishlist);
            
            Logger.important(`✨ Card ${cardId} updated: 👥${owners} ⭐${wants}${isInWishlist ? ' 🌟WISHLIST' : ''}`);

        } catch (error) {
            Logger.error(`Priority update error for ${cardId}:`, error);
            StatsBadge.update(cardElem, -1, -1, false, false, isInWishlist);
            Cache.set(cardId, -1, -1, true);
        }
    }

    /**
     * Quick refresh - show cached data for unprocessed cards
     */
    static async quickRefresh() {
        if (!ExtensionState.isEnabled()) return;
        if (!PageFilter.isCurrentPageEnabled()) return;

        const cards = DOMUtils.queryAllCards();
        let refreshed = 0;

        for (const cardElem of cards) {
            if (cardElem.classList.contains('mb_processed')) continue;

            let cardId = DOMUtils.getCardId(cardElem);
            if (!cardId) continue;

            // Only use cached IDs for special cards
            cardId = await CardIdResolver_Instance.resolve(cardId);
            if (!cardId) continue;

            // ПРОВЕРКА WISHLIST
            const isInWishlist = Wishlist.has(cardId);

            const cached = Cache.get(cardId);
            if (cached) {
                const isExpired = Cache.isExpired(cached);
                const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);
                
                StatsBadge.update(cardElem, cached.owners, cached.wants, isExpired, isManuallyUpdated, isInWishlist);
                
                cardElem.classList.add('mb_processed');
                cardElem.setAttribute('data-mb-processed', 'true');
                
                refreshed++;
            } else if (isInWishlist) {
                // Если нет в кэше, но есть в wishlist - показываем звездочку
                StatsBadge.updateWishlistStar(cardElem, true);
            }
        }

        if (refreshed > 0) {
            Logger.info(`Quick refresh: ${refreshed} cards updated from cache`);
        }
    }

    /**
     * НОВЫЙ МЕТОД: Очистка флагов обработки и повторная обработка
     * Используется на странице паков, где карты меняются на тех же позициях
     */
    static async clearProcessedMarksAndReprocess() {
        const cards = DOMUtils.queryAllCards();
        let changedCards = 0;

        // Проверяем каждую карту на изменение ID
        for (const cardElem of cards) {
            let cardId = DOMUtils.getCardId(cardElem);
            if (!cardId) continue;

            // Resolve special card IDs
            cardId = await CardIdResolver_Instance.resolve(cardId);
            if (!cardId) continue;

            const oldCardId = this.cardIdMap.get(cardElem);
            
            // Если ID изменился - сбрасываем флаг обработки
            if (oldCardId && oldCardId !== cardId) {
                cardElem.classList.remove('mb_processed');
                cardElem.removeAttribute('data-mb-processed');
                
                // Удаляем старый бейдж и звездочку
                const oldBadge = cardElem.querySelector('.mbuf_card_overlay');
                if (oldBadge) oldBadge.remove();
                const oldStar = cardElem.querySelector('.mbuf_wishlist_star');
                if (oldStar) oldStar.remove();
                
                changedCards++;
                Logger.info(`🔄 Card changed: ${oldCardId} → ${cardId}`);
            }

            // Обновляем карту ID
            this.cardIdMap.set(cardElem, cardId);
        }

        // Если есть изменившиеся карты - обрабатываем все
        if (changedCards > 0) {
            Logger.important(`🔄 Detected ${changedCards} changed cards, reprocessing...`);
            await this.processAll();
        }
    }

    /**
     * Cancel current batch
     */
    static cancelCurrentBatch() {
        this.batchProcessor.cancel();
    }

    /**
     * Get current progress
     */
    static getCurrentProgress() {
        return this.batchProcessor.getProgress();
    }

    /**
     * Clear all processed marks
     */
    static clearProcessedMarks() {
        document.querySelectorAll('.mb_processed').forEach(el => {
            el.classList.remove('mb_processed');
            el.removeAttribute('data-mb-processed');
        });
        
        // Очищаем карту ID
        this.cardIdMap.clear();
        
        Logger.info('Cleared all processed marks');
    }

    /**
     * Get statistics
     */
    static getStats() {
        return {
            processedInSession: this.processedInSession.size,
            currentProgress: this.getCurrentProgress(),
            isProcessing: this.isProcessing,
            queueSize: this.processingQueue.length,
            trackedCards: this.cardIdMap.size
        };
    }
}

// Message Handler for chrome extension messages - with Wishlist support (Full)
import { Cache } from './cache.js';
import { RateLimitTracker } from './rate-limit.js';
import { ExtensionState } from './extension-state.js';
import { PageFilter } from './page-filter.js';
import { CardProcessor } from './card-processor.js';
import { Wishlist } from './wishlist.js';
import { Logger } from './logger.js';

export class MessageHandler {
    static init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        Logger.info('Message handler initialized');
    }

    static async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getStats':
                    await this.handleGetStats(sendResponse);
                    break;
                    
                case 'setEnabled':
                    await this.handleSetEnabled(request, sendResponse);
                    break;
                    
                case 'setPageFilter':
                    await this.handleSetPageFilter(request, sendResponse);
                    break;
                    
                case 'getPageFilters':
                    await this.handleGetPageFilters(sendResponse);
                    break;
                    
                case 'clearCache':
                    await this.handleClearCache(sendResponse);
                    break;
                    
                case 'clearRateLimit':
                    await this.handleClearRateLimit(sendResponse);
                    break;
                    
                case 'refresh':
                    await this.handleRefresh(sendResponse);
                    break;
                    
                case 'exportCache':
                    await this.handleExportCache(sendResponse);
                    break;
                    
                case 'importCache':
                    await this.handleImportCache(request, sendResponse);
                    break;
                    
                case 'pruneErrors':
                    await this.handlePruneErrors(sendResponse);
                    break;
                
                // Wishlist handlers (Full)
                case 'fetchWishlist':
                    await this.handleFetchWishlist(request, sendResponse);
                    break;
                
                case 'exportWishlist':
                    await this.handleExportWishlist(sendResponse);
                    break;
                
                case 'importWishlist':
                    await this.handleImportWishlist(request, sendResponse);
                    break;
                
                case 'clearWishlist':
                    await this.handleClearWishlist(sendResponse);
                    break;
                
                case 'setWishlistEnabled':
                    await this.handleSetWishlistEnabled(request, sendResponse);
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            Logger.error('Message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleGetStats(sendResponse) {
        const stats = await Cache.getStats();
        const rateLimitStats = RateLimitTracker.getStats();
        const wishlistStats = Wishlist.getStats();
        
        sendResponse({
            ...stats,
            rateLimitInfo: rateLimitStats,
            wishlistStats: wishlistStats,
            enabled: ExtensionState.isEnabled(),
            pageFilters: PageFilter.getFilters(),
            currentPageType: PageFilter.getCurrentPageType(),
            currentPageEnabled: PageFilter.isCurrentPageEnabled()
        });
    }

    static async handleSetEnabled(request, sendResponse) {
        await ExtensionState.setEnabled(request.enabled);
        sendResponse({ success: true, enabled: request.enabled });
    }

    static async handleSetPageFilter(request, sendResponse) {
        const success = await PageFilter.setFilter(request.filterName, request.enabled);
        
        if (success) {
            if (PageFilter.getCurrentPageType() === request.filterName) {
                if (request.enabled) {
                    CardProcessor.processAll();
                } else {
                    document.querySelectorAll('.mbuf_card_overlay').forEach(badge => badge.remove());
                    document.querySelectorAll('.mbuf_wishlist_star').forEach(star => star.remove());
                    CardProcessor.clearProcessedMarks();
                    CardProcessor.cancelCurrentBatch();
                }
            }
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Invalid filter name' });
        }
    }

    static async handleGetPageFilters(sendResponse) {
        sendResponse({
            filters: PageFilter.getFilters(),
            currentPageType: PageFilter.getCurrentPageType(),
            currentPageEnabled: PageFilter.isCurrentPageEnabled()
        });
    }

    static async handleClearCache(sendResponse) {
        await Cache.clear();
        CardProcessor.clearProcessedMarks();
        sendResponse({ success: true });
        CardProcessor.processAll();
    }

    static async handleClearRateLimit(sendResponse) {
        await RateLimitTracker.forceReset();
        sendResponse({ success: true });
    }

    static async handleRefresh(sendResponse) {
        CardProcessor.clearProcessedMarks();
        sendResponse({ success: true });
        CardProcessor.processAll();
    }

    static async handleExportCache(sendResponse) {
        const data = Cache.exportToObject();
        sendResponse({ data });
    }

    static async handleImportCache(request, sendResponse) {
        await Cache.importFromObject(request.data);
        sendResponse({ success: true });
        CardProcessor.processAll();
    }

    static async handlePruneErrors(sendResponse) {
        const removed = await Cache.pruneErrors();
        sendResponse({ success: true, removed });
        
        CardProcessor.clearProcessedMarks();
        CardProcessor.processAll();
    }

    // Wishlist handlers (Full)
    static async handleFetchWishlist(request, sendResponse) {
        try {
            // Если URL не передан, используется дефолтный из конфига
            const result = await Wishlist.fetchFromGoogleSheet(request.url);
            
            if (result.success) {
                sendResponse({ success: true, count: result.count, cards: result.cards });
                // Перерисовываем карты чтобы показать звездочки
                CardProcessor.clearProcessedMarks();
                CardProcessor.processAll();
            } else {
                sendResponse({ success: false, error: result.error });
            }
        } catch (error) {
            Logger.error('handleFetchWishlist error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleExportWishlist(sendResponse) {
        try {
            const data = Wishlist.exportToJSON();
            sendResponse({ success: true, data });
        } catch (error) {
            Logger.error('handleExportWishlist error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleImportWishlist(request, sendResponse) {
        try {
            const result = await Wishlist.importFromJSON(request.data);
            
            if (result.success) {
                sendResponse({ success: true, count: result.count });
                // Перерисовываем карты чтобы показать звездочки
                CardProcessor.clearProcessedMarks();
                CardProcessor.processAll();
            } else {
                sendResponse({ success: false, error: result.error });
            }
        } catch (error) {
            Logger.error('handleImportWishlist error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleClearWishlist(sendResponse) {
        try {
            await Wishlist.clear();
            sendResponse({ success: true });
            // Убираем все звездочки
            document.querySelectorAll('.mbuf_wishlist_star').forEach(star => star.remove());
        } catch (error) {
            Logger.error('handleClearWishlist error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleSetWishlistEnabled(request, sendResponse) {
        try {
            await Wishlist.setEnabled(request.enabled);
            sendResponse({ success: true, enabled: request.enabled });
            
            // Перерисовываем карты
            if (request.enabled) {
                // Показываем звездочки
                CardProcessor.clearProcessedMarks();
                CardProcessor.processAll();
            } else {
                // Убираем все звездочки
                document.querySelectorAll('.mbuf_wishlist_star').forEach(star => star.remove());
            }
        } catch (error) {
            Logger.error('handleSetWishlistEnabled error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
}
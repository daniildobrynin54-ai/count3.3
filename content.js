// Main content script - Optimized v3.2 (Fixed imports + Performance boost + Wishlist)
(async function() {
    'use strict';

    // Dynamic module imports WITH CONFIG
    const { CONFIG } = await import(chrome.runtime.getURL('modules/config.js'));
    const { Logger } = await import(chrome.runtime.getURL('modules/logger.js'));
    const { NotificationManager } = await import(chrome.runtime.getURL('modules/notification.js'));
    const { ExtensionState } = await import(chrome.runtime.getURL('modules/extension-state.js'));
    const { PageFilter } = await import(chrome.runtime.getURL('modules/page-filter.js'));
    const { RateLimitTracker } = await import(chrome.runtime.getURL('modules/rate-limit.js'));
    const { Cache } = await import(chrome.runtime.getURL('modules/cache.js'));
    const { DOMObserver } = await import(chrome.runtime.getURL('modules/dom-observer.js'));
    const { MessageHandler } = await import(chrome.runtime.getURL('modules/message-handler.js'));
    const { CardProcessor } = await import(chrome.runtime.getURL('modules/card-processor.js'));
    const { Wishlist } = await import(chrome.runtime.getURL('modules/wishlist.js'));

    Logger.important('🚀 Mangabuff Card Stats v3.2 (Performance Optimized + Wishlist)');
    Logger.important('⚡ Cache: unlimited storage, no automatic deletions');

    // Initialize notification styles
    NotificationManager.initStyles();

    // Load extension state, page filters, rate limit, cache, and WISHLIST
    await ExtensionState.load();
    await PageFilter.load();
    await RateLimitTracker.init();
    
    // Try to load chunked cache first, fallback to normal load
    try {
        await Cache.loadChunked();
    } catch (e) {
        Logger.warn('Failed to load chunked cache, trying normal load:', e);
        await Cache.load();
    }

    // ОБЯЗАТЕЛЬНО ИНИЦИАЛИЗИРУЕМ WISHLIST
    await Wishlist.init();

    Logger.important(`💾 Cache: ${Cache.data.size} cards loaded`);
    Logger.important(`⭐ Wishlist: ${Wishlist.cards.size} cards, enabled: ${Wishlist.isEnabled}`);
    Logger.important(`🎯 Page: ${PageFilter.getCurrentPageType()} - ${PageFilter.isCurrentPageEnabled() ? 'ENABLED' : 'DISABLED'}`);

    // Initialize message handler
    MessageHandler.init();

    // Initialize DOM observer when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DOMObserver.init();
        });
    } else {
        DOMObserver.init();
    }

    // Page change detection - OPTIMIZED
    let lastUrl = location.href;
    const checkUrlChange = () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.important('🔄 Page changed to: ' + lastUrl);
            
            // Cancel current batch
            CardProcessor.cancelCurrentBatch();
            
            // Clear processed marks
            CardProcessor.clearProcessedMarks();
            
            // Process new page after short delay
            setTimeout(() => {
                if (ExtensionState.isEnabled() && PageFilter.isCurrentPageEnabled()) {
                    CardProcessor.processAll();
                }
            }, 500);
        }
    };

    setInterval(checkUrlChange, 1000);
    
    // Rate limit logging - LESS FREQUENT
    setInterval(() => {
        if (ExtensionState.isEnabled()) {
            const stats = RateLimitTracker.getStats();
            Logger.debug(`🛡️ Rate Limit: ${stats.current}/${stats.max} (${stats.remaining} remaining)`);
        }
    }, 15000); // Увеличено до 15 секунд

    // Auto-refresh for pack opening pages - OPTIMIZED
    if (location.pathname.includes('/cards/pack')) {
        Logger.important('🎴 Pack opening page - enabling smart auto-refresh');
        
        setInterval(() => {
            if (!ExtensionState.isEnabled()) return;
            if (!PageFilter.isCurrentPageEnabled()) return;
            
            // Очищаем флаги обработки и перепроверяем все карты
            CardProcessor.clearProcessedMarksAndReprocess();
        }, 1500); // Увеличено до 1.5 секунд для уменьшения нагрузки
    }

    Logger.important('✅ Extension fully initialized');
    Logger.important(`📊 Cache limit: ${CONFIG.MAX_CACHE_ENTRIES} entries (currently ${Cache.data.size})`);
})();
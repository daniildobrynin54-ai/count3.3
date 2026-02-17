// Background service worker - Optimized v3.2
console.log('[MBUF] Background service worker starting...');

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[MBUF] Extension installed');
        chrome.tabs.create({
            url: 'https://mangabuff.ru'
        });
    } else if (details.reason === 'update') {
        const version = chrome.runtime.getManifest().version;
        console.log(`[MBUF] Extension updated to v${version}`);
        
        if (details.previousVersion !== version) {
            console.log(`[MBUF] Upgraded from v${details.previousVersion} to v${version}`);
        }
    }
});

chrome.action.onClicked.addListener((tab) => {
    console.log('[MBUF] Extension icon clicked on tab:', tab.id);
});

console.log('[MBUF] Background service worker initialized (v3.2)');

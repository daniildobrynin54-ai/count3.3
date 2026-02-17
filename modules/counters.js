// Owners and Wants Counters with optimizations
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils, DOMUtils } from './utils.js';
import { HttpClient } from './http-client.js';

export class OwnersCounter {
    static async count(cardId, forceAccurate = false, skipRateLimit = false) {
        try {
            const url = CONFIG.API.CARD_USERS(cardId);
            
            const doc = await HttpClient.fetchAndParse(url, { skipRateLimit });
            const maxPage = DOMUtils.parsePageNumbers(doc);
            
            if (maxPage === 1) {
                const count = doc.querySelectorAll(CONFIG.SELECTORS.OWNERS).length;
                Logger.info(`Card ${cardId}: ${count} owners (1 page)`);
                return count;
            }

            if (maxPage >= CONFIG.OWNERS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                const approximateCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + 
                                       CONFIG.OWNERS_LAST_PAGE_ESTIMATE;
                Logger.info(`Card ${cardId}: ~${approximateCount} owners (${maxPage} pages, approximate)`);
                return approximateCount;
            }

            await Utils.sleep(800);

            const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
            const lastPageDoc = await HttpClient.fetchAndParse(lastPageUrl, { skipRateLimit });
            const lastPageCount = lastPageDoc.querySelectorAll(CONFIG.SELECTORS.OWNERS).length;
            const exactCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + lastPageCount;
            
            Logger.info(`Card ${cardId}: ${exactCount} owners (${maxPage} pages, exact)`);
            return exactCount;
            
        } catch (error) {
            Logger.error(`OwnersCounter error for card ${cardId}:`, error);
            return -1;
        }
    }
}

export class WantsCounter {
    static async count(cardId, forceAccurate = false, skipRateLimit = false) {
        try {
            const url = CONFIG.API.CARD_WANTS(cardId);
            
            const doc = await HttpClient.fetchAndParse(url, { skipRateLimit });
            const maxPage = DOMUtils.parsePageNumbers(doc);
            
            if (maxPage === 1) {
                const count = doc.querySelectorAll(CONFIG.SELECTORS.WANTS).length;
                Logger.info(`Card ${cardId}: ${count} wants (1 page)`);
                return count;
            }

            if (maxPage >= CONFIG.WANTS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                const approximateCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + 
                                       CONFIG.WANTS_LAST_PAGE_ESTIMATE;
                Logger.info(`Card ${cardId}: ~${approximateCount} wants (${maxPage} pages, approximate)`);
                return approximateCount;
            }

            await Utils.sleep(800);

            const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
            const lastPageDoc = await HttpClient.fetchAndParse(lastPageUrl, { skipRateLimit });
            const lastPageCount = lastPageDoc.querySelectorAll(CONFIG.SELECTORS.WANTS).length;
            const exactCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + lastPageCount;
            
            Logger.info(`Card ${cardId}: ${exactCount} wants (${maxPage} pages, exact)`);
            return exactCount;
            
        } catch (error) {
            Logger.error(`WantsCounter error for card ${cardId}:`, error);
            return -1;
        }
    }
}
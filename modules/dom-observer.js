// DOM Observer with debouncing
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { CardProcessor } from './card-processor.js';
import { ExtensionState } from './extension-state.js';
import { Utils } from './utils.js';

export class DOMObserver {
    static debounceTimer = null;
    static observer = null;

    static init() {
        CardProcessor.processAll();

        this.observer = new MutationObserver(
            Utils.debounce((mutations) => {
                if (!ExtensionState.isEnabled()) return;

                let foundNew = false;

                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;

                        if (node.classList?.contains('modal') ||
                            node.classList?.contains('popup') ||
                            node.classList?.contains('pack-opening') ||
                            node.classList?.contains('exchange') ||
                            node.classList?.contains('trade')) {
                            foundNew = true;
                            break;
                        }

                        for (const selector of CONFIG.CARD_SELECTORS) {
                            try {
                                const matched = node.matches?.(selector) ? [node] :
                                              Array.from(node.querySelectorAll?.(selector) || []);
                                if (matched.length > 0) {
                                    foundNew = true;
                                    break;
                                }
                            } catch (e) {
                                Logger.debug('Selector error:', selector, e);
                            }
                        }
                    }
                    if (foundNew) break;
                }

                if (foundNew) {
                    CardProcessor.quickRefresh();

                    if (this.debounceTimer) {
                        clearTimeout(this.debounceTimer);
                    }
                    this.debounceTimer = setTimeout(() => {
                        CardProcessor.processAll();
                    }, CONFIG.DEBOUNCE_DELAY);
                }
            }, 200)
        );

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        Logger.info('DOM Observer initialized');
    }

    static disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        Logger.info('DOM Observer disconnected');
    }
}
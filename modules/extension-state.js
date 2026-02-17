// Extension State Manager
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { storageGet, storageSet } from './storage.js';

export class ExtensionState {
    static enabled = true;

    static async load() {
        try {
            const enabled = await storageGet(CONFIG.ENABLED_KEY, true);
            this.enabled = enabled;
            Logger.important(`Extension ${this.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
            return this.enabled;
        } catch (e) {
            Logger.warn('ExtensionState load error:', e);
            this.enabled = true;
            return true;
        }
    }

    static async setEnabled(enabled) {
        this.enabled = enabled;
        await storageSet(CONFIG.ENABLED_KEY, enabled);
        Logger.important(`Extension ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
        
        if (!enabled) {
            const { CardProcessor } = await import('./card-processor.js');
            CardProcessor.cancelCurrentBatch();
            document.querySelectorAll('.mbuf_card_overlay').forEach(badge => badge.remove());
        } else {
            const { CardProcessor } = await import('./card-processor.js');
            await CardProcessor.processAll();
        }
    }

    static isEnabled() {
        return this.enabled;
    }
}

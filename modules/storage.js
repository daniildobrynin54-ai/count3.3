// Storage helpers
import { Logger } from './logger.js';

export async function storageGet(key, defaultValue = null) {
    try {
        const result = await chrome.storage.local.get(key);
        return result[key] !== undefined ? result[key] : defaultValue;
    } catch (e) {
        Logger.error('Storage get error:', e);
        return defaultValue;
    }
}

export async function storageSet(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (e) {
        Logger.error('Storage set error:', e);
        throw e;
    }
}

export async function storageRemove(key) {
    try {
        await chrome.storage.local.remove(key);
    } catch (e) {
        Logger.error('Storage remove error:', e);
    }
}

export async function storageClear() {
    try {
        await chrome.storage.local.clear();
        Logger.important('Storage cleared');
    } catch (e) {
        Logger.error('Storage clear error:', e);
    }
}

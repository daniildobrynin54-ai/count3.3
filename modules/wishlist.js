// Wishlist Manager - управление списком желаемых карт из Google таблицы
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { storageGet, storageSet } from './storage.js';

export class Wishlist {
    static cards = new Set(); // Set с ID карт из таблицы
    static lastUpdate = null;
    static isLoading = false;
    static isEnabled = true; // Состояние включено/выключено
    static autoUpdateTimer = null;

    /**
     * Инициализация - загрузить данные и запустить автообновление
     */
    static async init() {
        await this.load();
        
        // Автоматическая загрузка при первом запуске
        if (this.cards.size === 0 || !this.lastUpdate) {
            Logger.info('First run - loading wishlist automatically');
            await this.fetchFromGoogleSheet(CONFIG.WISHLIST_DEFAULT_URL);
        }
        
        // Запуск автообновления
        this.startAutoUpdate();
        
        Logger.important(`Wishlist initialized: ${this.cards.size} cards, enabled: ${this.isEnabled}`);
    }

    /**
     * Загрузить список из storage
     */
    static async load() {
        try {
            const data = await storageGet(CONFIG.WISHLIST_KEY, null);
            if (data && data.cards) {
                this.cards = new Set(data.cards);
                this.lastUpdate = data.lastUpdate || null;
                this.isEnabled = data.enabled !== undefined ? data.enabled : true;
                Logger.info(`Wishlist loaded: ${this.cards.size} cards, enabled: ${this.isEnabled}`);
            } else {
                this.cards = new Set();
                this.lastUpdate = null;
                this.isEnabled = true;
            }
        } catch (e) {
            Logger.error('Wishlist load error:', e);
            this.cards = new Set();
            this.isEnabled = true;
        }
    }

    /**
     * Сохранить список в storage
     */
    static async save() {
        try {
            await storageSet(CONFIG.WISHLIST_KEY, {
                cards: Array.from(this.cards),
                lastUpdate: this.lastUpdate,
                enabled: this.isEnabled
            });
            Logger.info(`Wishlist saved: ${this.cards.size} cards`);
        } catch (e) {
            Logger.error('Wishlist save error:', e);
        }
    }

    /**
     * Включить/выключить wishlist
     */
    static async setEnabled(enabled) {
        this.isEnabled = enabled;
        await this.save();
        Logger.important(`Wishlist ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    }

    /**
     * Проверить, включен ли wishlist
     */
    static getEnabled() {
        return this.isEnabled;
    }

    /**
     * Проверить, находится ли карта в списке (учитывает состояние enabled)
     */
    static has(cardId) {
        if (!this.isEnabled) return false;
        return this.cards.has(String(cardId));
    }

    /**
     * Добавить карту в список
     */
    static async add(cardId) {
        this.cards.add(String(cardId));
        await this.save();
    }

    /**
     * Удалить карту из списка
     */
    static async remove(cardId) {
        this.cards.delete(String(cardId));
        await this.save();
    }

    /**
     * Очистить весь список
     */
    static async clear() {
        this.cards.clear();
        this.lastUpdate = null;
        await this.save();
        Logger.info('Wishlist cleared');
    }

    /**
     * Запустить автоматическое обновление каждый час
     */
    static startAutoUpdate() {
        // Очистить предыдущий таймер если есть
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
        }

        // Запустить обновление каждый час
        this.autoUpdateTimer = setInterval(async () => {
            Logger.important('⏰ Auto-updating wishlist from Google Sheets');
            await this.fetchFromGoogleSheet(CONFIG.WISHLIST_DEFAULT_URL);
        }, CONFIG.WISHLIST_AUTO_UPDATE_INTERVAL);

        Logger.info(`Auto-update enabled: every ${CONFIG.WISHLIST_AUTO_UPDATE_INTERVAL / 1000 / 60} minutes`);
    }

    /**
     * Остановить автоматическое обновление
     */
    static stopAutoUpdate() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
            Logger.info('Auto-update disabled');
        }
    }

    /**
     * Парсинг публичной Google таблицы
     * URL должен быть в формате: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={GID}
     */
    static async fetchFromGoogleSheet(sheetUrl = null) {
        if (this.isLoading) {
            Logger.warn('Wishlist fetch already in progress');
            return { success: false, error: 'Already loading' };
        }

        // Используем URL по умолчанию если не передан
        const url = sheetUrl || CONFIG.WISHLIST_DEFAULT_URL;

        this.isLoading = true;

        try {
            // Извлекаем SHEET_ID и GID из URL
            const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const gidMatch = url.match(/[#&]gid=(\d+)/);

            if (!sheetIdMatch) {
                throw new Error('Invalid Google Sheets URL');
            }

            const sheetId = sheetIdMatch[1];
            const gid = gidMatch ? gidMatch[1] : '0';

            // Формируем URL для CSV экспорта
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

            Logger.info(`Fetching wishlist from: ${csvUrl}`);

            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const cardIds = this._parseCSV(csvText);

            if (cardIds.length === 0) {
                Logger.warn('No card IDs found in table');
                // Не выбрасываем ошибку, просто оставляем пустой список
            }

            // Обновляем список
            this.cards = new Set(cardIds);
            this.lastUpdate = Date.now();
            await this.save(); // ОБЯЗАТЕЛЬНО СОХРАНЯЕМ

            Logger.important(`✅ Wishlist updated: ${this.cards.size} cards loaded from Google Sheets`);

            return {
                success: true,
                count: this.cards.size,
                cards: Array.from(this.cards)
            };

        } catch (error) {
            Logger.error('Wishlist fetch error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Парсинг CSV и извлечение ID карт из столбца "Ссылка" (колонка C)
     */
    static _parseCSV(csvText) {
        const cardIds = new Set();
        const lines = csvText.split('\n');

        // Пропускаем заголовок (первую строку)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Разбиваем строку по запятым (простой парсер CSV)
            const columns = this._parseCSVLine(line);
            
            // Столбец C - это индекс 2 (A=0, B=1, C=2)
            if (columns.length > 2) {
                const linkCell = columns[2];
                
                // Извлекаем ID карты из ссылки формата /cards/128125/users
                const match = linkCell.match(/\/cards\/(\d+)/);
                if (match && match[1]) {
                    cardIds.add(match[1]);
                    Logger.debug(`Found card ID: ${match[1]}`);
                }
            }
        }

        Logger.info(`Parsed ${cardIds.size} card IDs from CSV`);
        return Array.from(cardIds);
    }

    /**
     * Простой парсер CSV строки (с учетом кавычек)
     */
    static _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Импорт списка из JSON
     */
    static async importFromJSON(jsonData) {
        try {
            let data;
            if (typeof jsonData === 'string') {
                data = JSON.parse(jsonData);
            } else {
                data = jsonData;
            }

            if (Array.isArray(data)) {
                this.cards = new Set(data.map(id => String(id)));
            } else if (data.cards && Array.isArray(data.cards)) {
                this.cards = new Set(data.cards.map(id => String(id)));
                // Сохраняем состояние enabled если оно есть в импортируемых данных
                if (data.enabled !== undefined) {
                    this.isEnabled = data.enabled;
                }
            } else {
                throw new Error('Invalid JSON format');
            }

            this.lastUpdate = Date.now();
            await this.save(); // ОБЯЗАТЕЛЬНО СОХРАНЯЕМ

            Logger.important(`Wishlist imported: ${this.cards.size} cards`);
            return { success: true, count: this.cards.size };

        } catch (error) {
            Logger.error('Wishlist import error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Экспорт списка в JSON
     */
    static exportToJSON() {
        return {
            cards: Array.from(this.cards),
            lastUpdate: this.lastUpdate,
            enabled: this.isEnabled,
            version: '1.0'
        };
    }

    /**
     * Получить статистику
     */
    static getStats() {
        return {
            total: this.cards.size,
            lastUpdate: this.lastUpdate,
            isLoading: this.isLoading,
            enabled: this.isEnabled
        };
    }

    /**
     * Получить список всех карт
     */
    static getAll() {
        return Array.from(this.cards);
    }
}
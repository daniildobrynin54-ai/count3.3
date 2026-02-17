// Configuration constants - OPTIMIZED v3.2
export const CONFIG = {
    // Selectors
    CARD_SELECTORS: [
        '.manga-cards__item',
        '.card-filter-list__card',
        '.deck__item',
        '.deck__list .deck__item',
        '.trade__main-item',
        '.trade__main-items a',
        '.trade__main-items--creator a',
        '.trade__main-items--receiver a',
        '.exchange-card',
        '.exchange__card',
        '.exchange-item__card',
        '.trade-card',
        '.trade__card',
        '[data-exchange-card]',
        '.pack-card',
        '.pack__card',
        '.pack-opening__card',
        '.lootbox__card',
        '.gacha-card',
        '.gacha__result-card',
        '[data-pack-card]',
        '.modal-card',
        '.popup-card'
    ],

    // Performance settings - OPTIMIZED
    BATCH_SIZE: 4,
    PAUSE_BETWEEN_REQUESTS: 5000,
    REQUEST_TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_429_DELAY: 15000,
    RETRY_429_MAX_ATTEMPTS: 3,
    DEBOUNCE_DELAY: 500,
    URL_CHECK_INTERVAL: 1000,
    RATE_LIMIT_LOG_INTERVAL: 15000,
    PACK_REFRESH_INTERVAL: 1500,
    STATS_UPDATE_INTERVAL: 3000,

    // Pagination
    OWNERS_PER_PAGE: 36,
    WANTS_PER_PAGE: 60,
    OWNERS_LAST_PAGE_ESTIMATE: 18,
    WANTS_LAST_PAGE_ESTIMATE: 30,

    // Thresholds
    OWNERS_APPROXIMATE_THRESHOLD: 11,
    WANTS_APPROXIMATE_THRESHOLD: 5,
    MAX_REQUESTS_PER_MINUTE: 70,
    RATE_LIMIT_WINDOW: 60000,
    MANUAL_UPDATE_COOLDOWN: 3600000,
    MAX_CACHE_ENTRIES: 500000,

    // Storage keys
    CACHE_KEY: 'mbuf_cache_v3',
    ENABLED_KEY: 'mbuf_enabled',
    PAGE_FILTERS_KEY: 'mbuf_page_filters',
    RATE_LIMIT_KEY: 'mbuf_rate_limit_requests',
    WISHLIST_KEY: 'mbuf_wishlist',  // ДОБАВЛЕНО

    // Wishlist settings
    WISHLIST_AUTO_UPDATE_INTERVAL: 3600000, // 1 час
    WISHLIST_DEFAULT_URL: 'https://docs.google.com/spreadsheets/d/1sYvrBU9BPhcoxTnNJfx8TOutxwFrSiRm2mw_8s6rdZM/edit?pli=1&gid=1363566974',

    // TTL settings (in milliseconds)
    TTL: {
        VERY_RARE: 2 * 60 * 60 * 1000,
        RARE: 6 * 60 * 60 * 1000,
        UNCOMMON: 24 * 60 * 60 * 1000,
        COMMON: 96 * 60 * 60 * 1000,
        FREQUENT: 192 * 60 * 60 * 1000,
        VERY_COMMON: 336 * 60 * 60 * 1000
    },

    // Debug mode
    DEBUG: false,

    // Default page filters
    DEFAULT_PAGE_FILTERS: {
        packOpening: true,
        marketLots: true,
        marketLotPage: true,
        marketRequests: true,
        marketRequestCreate: true,
        userCards: true,
        userShowcase: true,
        tradeCreatePages: true,
        tradePages: true,
        deckPages: true,
        other: true
    },

    // Page type patterns
    PAGE_PATTERNS: {
        packOpening: /\/cards\/pack/,
        marketRequestCreate: /\/market\/requests\/create/,
        marketRequests: /^\/market\/requests/,
        marketLotPage: /^\/market\/\d+/,
        marketLots: /^\/market(?:\?|$)/,
        userCards: /^\/users\/\d+\/cards/,
        userShowcase: /^\/users\/\d+(?:\/showcase)?$/,
        tradeCreatePages: /^\/trades\/offers\/\d+/,
        tradePages: /^\/trades\/\d+/,
        deckPages: /^\/decks\/\d+/
    },

    // API endpoints
    API: {
        CARD_USERS: (id) => `https://mangabuff.ru/cards/${id}/users`,
        CARD_WANTS: (id) => `https://mangabuff.ru/cards/${id}/offers/want`,
        MARKET_LOT: (id) => `https://mangabuff.ru/market/${id}`,
        MARKET_REQUEST: (id) => `https://mangabuff.ru/market/requests/${id}`
    },

    // Selectors for counting
    SELECTORS: {
        OWNERS: '.card-show__owner',
        WANTS: '.profile__friends-item, .users-list__item, .user-card',
        CARD_LINK: 'a[href*="/cards/"][href*="/users"]',
        PAGINATION: '.pagination__button, .pagination > li > a, .pagination > li, .paginator a'
    }
};

// Error types
export const ERROR_TYPES = {
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    PARSE: 'PARSE_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR'
};

// Card ID prefixes
export const CARD_ID_PREFIX = {
    MARKET: 'market:',
    REQUEST: 'request:'
};
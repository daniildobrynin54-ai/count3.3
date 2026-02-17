// UI Badge for cards with wishlist star support + compact mode for history cards
import { DOMUtils } from './utils.js';

/**
 * Detect card size type:
 *   'tiny'   - .history__body-item  (small history cards)
 *   'trade'  - .trade__main-item    (medium trade panel cards)
 *   'normal' - everything else
 */
function getCardSizeType(cardElem) {
    if (cardElem.classList.contains('history__body-item')) return 'tiny';
    if (cardElem.classList.contains('trade__main-item'))   return 'trade';
    return 'normal';
}

export class StatsBadge {
    static update(cardElem, owners, wants, isExpired = false, isManuallyUpdated = false, isInWishlist = false) {
        if (!cardElem) return;

        const badgeClass = 'mbuf_card_overlay';
        let badge = cardElem.querySelector(`.${badgeClass}`);
        if (!badge) badge = this.create(cardElem, badgeClass);
        this.render(badge, owners, wants, isExpired, isManuallyUpdated, getCardSizeType(cardElem));

        // Wishlist star
        this.updateWishlistStar(cardElem, isInWishlist);
    }

    static create(cardElem, badgeClass) {
        const badge = document.createElement('div');
        badge.className = badgeClass;

        const sizeType = getCardSizeType(cardElem);
        const isMobile = window.innerWidth <= 768;

        if (sizeType === 'tiny') {
            // ── TINY (history) ──────────────────────────────────────────────
            // Thin bar pinned to the TOP of the card thumbnail.
            Object.assign(badge.style, {
                position: 'absolute',
                left: '0',
                right: '0',
                top: '0',
                zIndex: '10',
                background: 'rgba(0,0,0,0.82)',
                color: '#fff',
                fontSize: '9px',
                lineHeight: '1',
                padding: '3px 2px',
                display: 'flex',
                justifyContent: 'center',
                gap: '4px',
                alignItems: 'center',
                pointerEvents: 'auto',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                touchAction: 'manipulation',
                borderRadius: '4px 4px 0 0'
            });

        } else if (sizeType === 'trade') {
            // ── TRADE ────────────────────────────────────────────────────────
            Object.assign(badge.style, {
                position: 'absolute',
                right: '4px',
                top: '20px',
                zIndex: '10',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                fontSize: '10px',
                padding: '2px 5px',
                borderRadius: '12px',
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
                pointerEvents: 'auto',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.3s',
                cursor: 'pointer',
                touchAction: 'manipulation'
            });

        } else {
            // ── NORMAL ────────────────────────────────────────────────────────
            Object.assign(badge.style, {
                position: 'absolute',
                right: '6px',
                top: '26px',
                zIndex: '10',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                fontSize: isMobile ? '10px' : '12px',
                padding: isMobile ? '2px 5px' : '4px 8px',
                borderRadius: '12px',
                display: 'flex',
                gap: isMobile ? '4px' : '8px',
                alignItems: 'center',
                pointerEvents: 'auto',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.3s',
                cursor: 'pointer',
                touchAction: 'manipulation'
            });
        }

        badge.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cardId = DOMUtils.getCardId(cardElem);
            if (cardId) {
                try {
                    const { CardProcessor } = await import('./card-processor.js');
                    await CardProcessor.priorityUpdateCard(cardElem, cardId);
                } catch (error) {
                    console.error('[MBUF] Error updating card:', error);
                }
            }
        });

        if (getComputedStyle(cardElem).position === 'static') {
            cardElem.style.position = 'relative';
        }
        cardElem.appendChild(badge);
        return badge;
    }

    static render(badge, owners, wants, isExpired = false, isManuallyUpdated = false, sizeType = 'normal') {
        if (!badge) return;

        // Background / border colour
        if (owners === '⌛' && isManuallyUpdated) {
            badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,165,0,0.95))';
            badge.style.border     = '2px solid rgba(255,223,0,0.8)';
            badge.style.boxShadow  = '0 0 20px rgba(255,215,0,0.6)';
        } else if (isManuallyUpdated) {
            badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.9), rgba(218,165,32,0.9))';
            badge.style.border     = '1px solid rgba(255,223,0,0.5)';
            badge.style.boxShadow  = 'none';
        } else if (isExpired && owners !== '⌛' && owners !== -1) {
            badge.style.background = 'rgba(200,50,50,0.9)';
            badge.style.border     = '1px solid rgba(255,100,100,0.3)';
            badge.style.boxShadow  = 'none';
        } else {
            if (sizeType === 'tiny') {
                badge.style.background  = 'rgba(0,0,0,0.82)';
                badge.style.border      = 'none';
                badge.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
            } else {
                badge.style.background = 'rgba(0,0,0,0.85)';
                badge.style.border     = '1px solid rgba(255,255,255,0.06)';
            }
            badge.style.boxShadow = 'none';
        }

        const fmt = c => {
            if (c === -1)   return '<span style="color:#ff6b6b">err</span>';
            if (c === '⌛') return '<span style="color:#ffd93d">⌛</span>';
            return String(c);
        };

        if (sizeType === 'tiny') {
            // Compact top bar: "👥42 · ⭐5"
            const ownersLabel = owners === -1 ? 'err' : (owners === '⌛' ? '⌛' : owners);
            const wantsLabel  = wants  === -1 ? 'err' : (wants  === '⌛' ? '⌛' : wants);
            const expDot = isExpired       ? '<span style="color:#ff9999;font-size:7px">●</span>' : '';
            const manDot = isManuallyUpdated ? '<span style="color:#ffd700;font-size:7px">✨</span>' : '';

            badge.innerHTML = `
                <span title="Владельцев: ${ownersLabel} — клик для обновления"
                      style="display:flex;align-items:center;gap:1px">
                    👥${fmt(owners)}${expDot}${manDot}
                </span>
                <span style="opacity:0.4">·</span>
                <span title="Желающих: ${wantsLabel} — клик для обновления"
                      style="display:flex;align-items:center;gap:1px">
                    ⭐${fmt(wants)}
                </span>
            `;
        } else {
            const expiredIndicator = isExpired        ? ' 🔄' : '';
            const manualIndicator  = isManuallyUpdated ? ' ✨' : '';

            const ownersTooltip = isManuallyUpdated
                ? `Владельцев: ${owners === -1 ? 'ошибка' : owners} (ТОЧНОЕ, обновлено вручную)`
                : `Владельцев: ${owners === -1 ? 'ошибка' : owners}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления`;
            const wantsTooltip = isManuallyUpdated
                ? `Желающих: ${wants === -1 ? 'ошибка' : wants} (ТОЧНОЕ, обновлено вручную)`
                : `Желающих: ${wants === -1 ? 'ошибка' : wants}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления`;

            badge.innerHTML = `
                <span title="${ownersTooltip}">
                    👥${fmt(owners)}${expiredIndicator}${manualIndicator}
                </span>
                <span title="${wantsTooltip}">
                    ⭐${fmt(wants)}
                </span>
            `;
        }
    }

    // ─── Wishlist star ────────────────────────────────────────────────────────

    static updateWishlistStar(cardElem, isInWishlist) {
        if (!cardElem) return;

        const starClass = 'mbuf_wishlist_star';
        let star = cardElem.querySelector(`.${starClass}`);

        if (isInWishlist) {
            if (!star) star = this.createWishlistStar(cardElem, starClass);
        } else {
            if (star) star.remove();
        }
    }

    static createWishlistStar(cardElem, starClass) {
        const star = document.createElement('div');
        star.className = starClass;

        const sizeType = getCardSizeType(cardElem);
        const isMobile = window.innerWidth <= 768;

        // For tiny cards: smaller star positioned below the top stats bar
        const size  = sizeType === 'tiny' ? '16px' : (isMobile ? '24px' : (sizeType === 'trade' ? '28px' : '32px'));
        const fSize = sizeType === 'tiny' ? '10px' : (isMobile ? '14px' : (sizeType === 'trade' ? '16px' : '18px'));
        // Offset tiny star below the stats bar (~16px bar height)
        const top   = sizeType === 'tiny' ? '18px' : '6px';
        const left  = '4px';

        Object.assign(star.style, {
            position: 'absolute',
            left,
            top,
            zIndex: '11',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            color: '#fff',
            fontSize: fSize,
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 2px 8px rgba(255,215,0,0.5)',
            animation: 'wishlistPulse 2s ease-in-out infinite'
        });

        star.innerHTML = '⭐';
        star.title = 'Карта из вашего wishlist!';

        if (getComputedStyle(cardElem).position === 'static') {
            cardElem.style.position = 'relative';
        }

        cardElem.appendChild(star);

        if (!document.getElementById('mbuf-wishlist-animation')) {
            const style = document.createElement('style');
            style.id = 'mbuf-wishlist-animation';
            style.textContent = `
                @keyframes wishlistPulse {
                    0%, 100% { transform: scale(1);   box-shadow: 0 2px 8px  rgba(255,215,0,0.5); }
                    50%       { transform: scale(1.1); box-shadow: 0 4px 16px rgba(255,215,0,0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        return star;
    }
}
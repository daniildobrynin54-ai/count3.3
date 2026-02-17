// Notification Manager (unchanged but with better cleanup)
import { Logger } from './logger.js';

export class NotificationManager {
    static currentNotification = null;
    static countdownInterval = null;
    static autoHideTimeout = null;

    static showRateLimitWarning(seconds) {
        this.hideNotification();

        const notification = document.createElement('div');
        notification.className = 'mbuf-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #FF6B6B, #FF8E53);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 280px;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="font-size: 24px;">⚠️</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Rate Limit достигнут!</div>
                <div style="font-size: 12px; opacity: 0.95;">Ожидание: <span id="mbuf-countdown" style="font-weight: 700; color: #FFD93D;">${seconds}</span> сек</div>
            </div>
            <div class="mbuf-close-btn" style="font-size: 18px; opacity: 0.7; margin-left: 8px; cursor: pointer; padding: 4px;" title="Закрыть">✕</div>
        `;

        document.body.appendChild(notification);
        this.currentNotification = notification;

        const countdownElement = document.getElementById('mbuf-countdown');
        
        const closeBtn = notification.querySelector('.mbuf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideNotification();
            });
        }

        notification.addEventListener('click', () => {
            this.hideNotification();
        });

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        let remaining = seconds;
        
        this.countdownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                this.hideNotification();
            } else {
                if (countdownElement) {
                    countdownElement.textContent = remaining;
                    if (remaining <= 5) {
                        countdownElement.style.color = '#4CAF50';
                    }
                }
            }
        }, 1000);

        Logger.info(`⏳ Rate limit notification: ${seconds}s countdown`);
    }

    static show429Error(seconds, attempt, maxAttempts) {
        this.hideNotification();

        const notification = document.createElement('div');
        notification.className = 'mbuf-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #E91E63, #F44336);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 280px;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="font-size: 24px;">🚫</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Ошибка 429</div>
                <div style="font-size: 12px; opacity: 0.95;">Сервер отклонил запрос (${attempt}/${maxAttempts})</div>
            </div>
            <div class="mbuf-close-btn" style="font-size: 18px; opacity: 0.7; margin-left: 8px; cursor: pointer; padding: 4px;" title="Закрыть">✕</div>
        `;

        document.body.appendChild(notification);
        this.currentNotification = notification;

        const closeBtn = notification.querySelector('.mbuf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideNotification();
            });
        }

        notification.addEventListener('click', () => {
            this.hideNotification();
        });

        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }
        
        this.autoHideTimeout = setTimeout(() => {
            this.hideNotification();
        }, 5000);

        Logger.info('🚫 429 Error notification shown');
    }

    static hideNotification() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }

        if (this.currentNotification) {
            this.currentNotification.style.animation = 'slideUp 0.3s ease';
            
            const notifToRemove = this.currentNotification;
            setTimeout(() => {
                if (notifToRemove && notifToRemove.parentNode) {
                    notifToRemove.remove();
                }
            }, 300);
            
            this.currentNotification = null;
        }
    }

    static initStyles() {
        if (document.getElementById('mbuf-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mbuf-notification-styles';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateX(-50%) translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
            @keyframes slideUp {
                from {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(-50%) translateY(-100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

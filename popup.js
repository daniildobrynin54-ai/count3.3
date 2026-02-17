// Popup script для управления расширением v3.2.1 (Fixed + Simplified Wishlist)
document.addEventListener('DOMContentLoaded', async () => {
    const statsDiv = document.getElementById('stats');
    const rateLimitBox = document.getElementById('rateLimitBox');
    const rateLimitFill = document.getElementById('rateLimitFill');
    const rateLimitText = document.getElementById('rateLimitText');
    const rateLimitRemaining = document.getElementById('rateLimitRemaining');
    const rateLimitReset = document.getElementById('rateLimitReset');
    const toggleSwitch = document.getElementById('toggleSwitch');
    const toggleIcon = document.getElementById('toggleIcon');
    const statusBadge = document.getElementById('statusBadge');
    const pageFiltersContainer = document.getElementById('pageFiltersContainer');
    
    // Wishlist elements
    const wishlistToggle = document.getElementById('wishlistToggle');
    const wishlistContent = document.getElementById('wishlistContent');
    const wishlistCount = document.getElementById('wishlistCount');
    const wishlistInfo = document.getElementById('wishlistInfo');
    const updateWishlistBtn = document.getElementById('updateWishlistBtn');
    
    // Cache buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearBtn = document.getElementById('clearBtn');
    const pruneErrorsBtn = document.getElementById('pruneErrorsBtn');
    const clearRateLimitBtn = document.getElementById('clearRateLimitBtn');
    const fileInput = document.getElementById('fileInput');
    const messageDiv = document.getElementById('message');

    let currentEnabled = true;
    let currentPageType = null;
    let wishlistEnabled = true;

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async function sendMessage(action, data = {}) {
        const tab = await getCurrentTab();
        if (!tab || !tab.id || !tab.url?.includes('mangabuff.ru')) {
            // Не отправляем сообщения на страницы, которые не являются mangabuff.ru
            return null;
        }
        
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    // Игнорируем ошибки, так как страница может быть не готова
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }

    function showMessage(text, type = 'success') {
        const className = type === 'success' ? 'success-message' : 'info-message';
        messageDiv.innerHTML = `<div class="${className}">${text}</div>`;
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }

    function updateToggleUI(enabled) {
        currentEnabled = enabled;
        
        if (enabled) {
            toggleSwitch.classList.add('active');
            toggleIcon.textContent = '🎴';
            statusBadge.textContent = 'ВКЛ';
            statusBadge.className = 'status-badge enabled';
        } else {
            toggleSwitch.classList.remove('active');
            toggleIcon.textContent = '⸻';
            statusBadge.textContent = 'ВЫКЛ';
            statusBadge.className = 'status-badge disabled';
        }
    }

    function updateWishlistToggleUI(enabled) {
        wishlistEnabled = enabled;
        
        if (enabled) {
            wishlistToggle.classList.add('active');
            wishlistContent.classList.remove('wishlist-disabled-overlay');
        } else {
            wishlistToggle.classList.remove('active');
            wishlistContent.classList.add('wishlist-disabled-overlay');
        }
    }

    function updateWishlistUI(stats) {
        if (!stats) return;

        wishlistCount.textContent = `${stats.total} карт`;

        const lastUpdateText = stats.lastUpdate 
            ? new Date(stats.lastUpdate).toLocaleString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit', 
                minute: '2-digit' 
              })
            : 'никогда';
        
        wishlistInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="opacity: 0.8;">Карт в списке:</span>
                <span style="font-weight: 600; color: #FFD700;">${stats.total}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="opacity: 0.8;">Обновлено:</span>
                <span style="font-size: 11px;">${lastUpdateText}</span>
            </div>
        `;

        // Update toggle state
        updateWishlistToggleUI(stats.enabled);
    }

    function renderPageFilters(filters, currentPageType) {
        if (!filters) {
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
            return;
        }

        const pageTypeLabels = {
            packOpening: '🎴 Открытие паков',
            marketLots: '🏪 Маркет (главная)',
            marketLotPage: '📦 Страница лота',
            marketRequests: '📋 Заявки',
            marketRequestCreate: '✍️ Создание заявки',
            userCards: '👤 Карты пользователя',
            userShowcase: '🏆 Витрина',
            tradeCreatePages: '✨ Создание обмена',
            tradePages: '🔄 Обмены',
            deckPages: '📚 Колоды',
            other: '🌐 Остальное'
        };

        pageFiltersContainer.innerHTML = '';

        for (const [key, label] of Object.entries(pageTypeLabels)) {
            const isActive = filters[key];
            const isCurrent = key === currentPageType;

            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'filter-label';
            labelDiv.innerHTML = `
                <span>${label}</span>
                ${isCurrent ? '<span class="current-page-badge">текущая</span>' : ''}
            `;

            const toggleDiv = document.createElement('div');
            toggleDiv.className = `filter-toggle ${isActive ? 'active' : ''}`;
            toggleDiv.innerHTML = '<div class="filter-slider"></div>';
            
            toggleDiv.addEventListener('click', async () => {
                const newState = !isActive;
                
                if (newState) {
                    toggleDiv.classList.add('active');
                } else {
                    toggleDiv.classList.remove('active');
                }

                const response = await sendMessage('setPageFilter', { 
                    filterName: key, 
                    enabled: newState 
                });

                if (response && response.success) {
                    filters[key] = newState;
                    showMessage(
                        `${label}: ${newState ? 'включено' : 'выключено'}`,
                        'info'
                    );
                    
                    if (isCurrent) {
                        setTimeout(loadStats, 500);
                    }
                } else {
                    if (newState) {
                        toggleDiv.classList.remove('active');
                    } else {
                        toggleDiv.classList.add('active');
                    }
                    showMessage('Ошибка изменения фильтра', 'info');
                }
            });

            filterItem.appendChild(labelDiv);
            filterItem.appendChild(toggleDiv);
            pageFiltersContainer.appendChild(filterItem);
        }
    }

    // Main extension toggle
    toggleSwitch.addEventListener('click', async () => {
        const newState = !currentEnabled;
        updateToggleUI(newState);
        
        const response = await sendMessage('setEnabled', { enabled: newState });
        if (response && response.success) {
            showMessage(newState ? '✅ Расширение включено' : '⸻ Расширение выключено', 'info');
            await loadStats();
        } else {
            updateToggleUI(!newState);
            showMessage('❌ Ошибка изменения состояния', 'info');
        }
    });

    // Wishlist toggle
    wishlistToggle.addEventListener('click', async () => {
        const newState = !wishlistEnabled;
        updateWishlistToggleUI(newState);
        
        const response = await sendMessage('setWishlistEnabled', { enabled: newState });
        if (response && response.success) {
            showMessage(newState ? '⭐ Wishlist включен' : '⭐ Wishlist выключен', 'info');
            await loadStats();
        } else {
            updateWishlistToggleUI(!newState);
            showMessage('❌ Ошибка изменения Wishlist', 'info');
        }
    });

    // Update wishlist button
    updateWishlistBtn.addEventListener('click', async () => {
        updateWishlistBtn.disabled = true;
        updateWishlistBtn.innerHTML = '<span class="icon">⳿</span><span>Загрузка...</span>';

        const response = await sendMessage('fetchWishlist', { 
            url: null // Используем URL по умолчанию из конфига
        });

        if (response && response.success) {
            showMessage(`✅ Wishlist обновлен: ${response.count} карт`);
            await loadStats();
        } else {
            showMessage(`❌ Ошибка: ${response?.error || 'Неизвестная ошибка'}`);
        }

        setTimeout(() => {
            updateWishlistBtn.disabled = false;
            updateWishlistBtn.innerHTML = '<span class="icon">🔄</span><span>Обновить из Google Sheets</span>';
        }, 1000);
    });

    // Cache buttons
    refreshBtn.addEventListener('click', async () => {
        if (!currentEnabled) {
            showMessage('⚠️ Включите расширение для обновления', 'info');
            return;
        }

        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="icon">⳿</span><span>Обновление...</span>';
        
        await sendMessage('refresh');
        showMessage('✅ Карты обновляются');
        
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="icon">🔄</span><span>Обновить карты</span>';
            loadStats();
        }, 1000);
    });

    exportBtn.addEventListener('click', async () => {
        const response = await sendMessage('exportCache');
        if (response && response.data) {
            const dataStr = JSON.stringify(response.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mbuf_cache_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showMessage('✅ Кэш экспортирован');
        } else {
            showMessage('❌ Ошибка экспорта');
        }
    });

    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            await sendMessage('importCache', { data });
            showMessage('✅ Кэш импортирован');
            loadStats();
        } catch (err) {
            showMessage('❌ Ошибка импорта: ' + err.message);
        }
        
        fileInput.value = '';
    });

    pruneErrorsBtn.addEventListener('click', async () => {
        if (!confirm('Удалить ТОЛЬКО записи с ошибками из кэша?\n\nУстаревшие данные сохранятся.')) return;
        
        pruneErrorsBtn.disabled = true;
        pruneErrorsBtn.innerHTML = '<span class="icon">⳿</span><span>Очистка...</span>';
        
        const response = await sendMessage('pruneErrors');
        
        if (response && response.success) {
            showMessage(`✅ Удалено ${response.removed} записей с ошибками`);
        } else {
            showMessage('❌ Ошибка очистки');
        }
        
        setTimeout(() => {
            pruneErrorsBtn.disabled = false;
            pruneErrorsBtn.innerHTML = '<span class="icon">🧹</span><span>Удалить только ошибки</span>';
            loadStats();
        }, 1000);
    });

    clearBtn.addEventListener('click', async () => {
        if (!confirm('Очистить ВЕСЬ кэш? Это удалит ВСЕ данные!\n\nВы потеряете всю сохраненную статистику.')) return;
        
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<span class="icon">⳿</span><span>Очистка...</span>';
        
        await sendMessage('clearCache');
        showMessage('✅ Весь кэш очищен');
        
        setTimeout(() => {
            clearBtn.disabled = false;
            clearBtn.innerHTML = '<span class="icon">🗑️</span><span>Очистить весь кэш</span>';
            loadStats();
        }, 1000);
    });

    clearRateLimitBtn.addEventListener('click', async () => {
        if (!confirm('Сбросить счётчик rate limit? Используйте только в экстренных случаях!')) return;
        
        clearRateLimitBtn.disabled = true;
        clearRateLimitBtn.innerHTML = '<span class="icon">⳿</span><span>Сброс...</span>';
        
        await sendMessage('clearRateLimit');
        showMessage('✅ Rate limit сброшен');
        
        setTimeout(() => {
            clearRateLimitBtn.disabled = false;
            clearRateLimitBtn.innerHTML = '<span class="icon">🔄</span><span>Сбросить Rate Limit</span>';
            loadStats();
        }, 1000);
    });

    async function loadStats() {
        const tab = await getCurrentTab();
        if (!tab || !tab.url?.includes('mangabuff.ru')) {
            statsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px; opacity: 0.8;">
                    ℹ️ Откройте сайт mangabuff.ru
                </div>
            `;
            rateLimitBox.style.display = 'none';
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
            return;
        }

        const stats = await sendMessage('getStats');
        
        if (stats) {
            updateToggleUI(stats.enabled);
            currentPageType = stats.currentPageType;

            const pageStatusText = stats.currentPageEnabled 
                ? '<span style="color: #4CAF50;">✓ Активна</span>' 
                : '<span style="color: #FF6B6B;">✗ Отключена</span>';

            statsDiv.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">💾 Карт в кэше</span>
                    <span class="stat-value">${stats.total.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⏰ Устаревших</span>
                    <span class="stat-value">${stats.expired.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">❌ С ошибками</span>
                    <span class="stat-value">${stats.errors.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">✅ Актуальных</span>
                    <span class="stat-value">${stats.valid.toLocaleString()}</span>
                </div>
                <div class="stat-item" style="font-size: 12px;">
                    <span class="stat-label">📍 Текущая страница</span>
                    <span>${pageStatusText}</span>
                </div>
            `;

            if (stats.pageFilters) {
                renderPageFilters(stats.pageFilters, stats.currentPageType);
            }

            if (stats.wishlistStats) {
                updateWishlistUI(stats.wishlistStats);
            }

            if (stats.rateLimitInfo) {
                const { current, max, remaining, resetIn } = stats.rateLimitInfo;
                const percentage = (current / max) * 100;
                
                rateLimitBox.style.display = 'block';
                rateLimitFill.style.width = `${percentage}%`;
                rateLimitText.textContent = `${current}/${max}`;
                rateLimitRemaining.textContent = `Осталось: ${remaining}`;
                rateLimitReset.textContent = `Сброс через: ${resetIn}с`;

                rateLimitFill.classList.remove('warning', 'danger');
                if (percentage >= 90) {
                    rateLimitFill.classList.add('danger');
                } else if (percentage >= 70) {
                    rateLimitFill.classList.add('warning');
                }
            }
        } else {
            statsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px; opacity: 0.8;">
                    ⚠️ Не удалось загрузить данные
                </div>
            `;
            rateLimitBox.style.display = 'none';
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
        }
    }

    await loadStats();
    setInterval(loadStats, 3000);
});
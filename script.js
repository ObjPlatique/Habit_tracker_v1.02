// Habit Tracker Application with Routine View Menu and Day Details
// Initialize Language Manager
const langManager = new LanguageManager();
window.langManager = langManager;

// Automatic timezone detection from browser locale/location
function detectUserTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    localStorage.setItem('timezone', tz);
    return tz;
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            if ('sync' in registration) {
                registration.sync.register('habit-sync').catch(() => {
                    // Ignore registration errors in unsupported browsers.
                });
            }
        } catch (error) {
            console.warn('Service worker registration failed:', error);
        }
    });
}

function getNetworkStatusElement() {
    return document.getElementById('networkStatus');
}

function updateNetworkStatusIndicator({ online = navigator.onLine, syncing = false, pendingSync = false } = {}) {
    const el = getNetworkStatusElement();
    if (!el) return;

    let nextClass = 'network-status online';
    let nextText = '🟢 Online mode';

    if (!online) {
        nextClass = 'network-status offline';
        nextText = '🔴 Offline mode';
    } else if (syncing) {
        nextClass = 'network-status syncing';
        nextText = '🔄 Syncing local changes...';
    } else if (pendingSync) {
        nextClass = 'network-status syncing';
        nextText = '🟡 Online (sync pending)';
    }

    if (el.className === nextClass && el.textContent === nextText) return;
    el.className = nextClass;
    el.textContent = nextText;
}

const THEME_STORAGE_KEY = 'themePreference';

function debounce(fn, delay = 200) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

function getSavedThemePreference() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }
    return null;
}

function detectSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, { persist = false } = {}) {
    document.body.setAttribute('data-theme', theme);

    const themeToggle = document.getElementById('themeToggle');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const isDark = theme === 'dark';

    if (themeToggle) {
        themeToggle.checked = isDark;
    }

    if (themeToggleBtn) {
        themeToggleBtn.setAttribute('aria-pressed', String(isDark));
        themeToggleBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    }

    if (persist) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        localStorage.setItem('theme', theme);
    }
}

function initializeTheme() {
    const savedTheme = getSavedThemePreference();
    const activeTheme = savedTheme || detectSystemTheme();
    applyTheme(activeTheme);

    const themeToggle = document.getElementById('themeToggle');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    if (themeToggle) {
        themeToggle.addEventListener('change', (event) => {
            applyTheme(event.target.checked ? 'dark' : 'light', { persist: true });
        });
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark', { persist: true });
        });
    }

    if (!savedTheme && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (event) => {
            applyTheme(event.matches ? 'dark' : 'light');
        });
    }
}

// Setup event listeners for settings
document.addEventListener('DOMContentLoaded', () => {
    detectUserTimezone();
    registerServiceWorker();

    document.getElementById('sidebarLanguageSelect').value = langManager.currentLanguage;
    langManager.updatePageLanguage();

    document.getElementById('sidebarLanguageSelect').addEventListener('change', (e) => {
        langManager.setLanguage(e.target.value);
    });

    initializeTheme();

    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
        document.body.classList.toggle('sidebar-collapsed', savedSidebarState === 'true');
    } else if (window.innerWidth <= 992) {
        document.body.classList.add('sidebar-collapsed');
    }

    updateNetworkStatusIndicator({ pendingSync: localStorage.getItem('habitSyncPending') === 'true' });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SYNC_REQUESTED' && window.app?.syncPendingChanges) {
                window.app.syncPendingChanges({ silent: true });
            }
        });
    }
});

class CalendarHeatmap {
    constructor(container) {
        this.container = container;
    }

    update(cells) {
        this.container.innerHTML = cells.map((cell, index) => {
            const classes = ['heatmap-cell'];
            if (cell.completed === 0 && cell.missed > 0) classes.push('missed');
            if (cell.completed > 0) classes.push('completed');
            if (cell.ratio >= 0.75) classes.push('high');
            else if (cell.ratio >= 0.4) classes.push('medium');
            else if (cell.ratio > 0) classes.push('low');

            return `<button class="${classes.join(' ')}" style="animation-delay:${index * 7}ms" title="${cell.label}: ${cell.completed} completed / ${cell.missed} missed" aria-label="${cell.label}: ${cell.completed} completed, ${cell.missed} missed"></button>`;
        }).join('');
    }
}

class ProgressRings {
    constructor(container) {
        this.container = container;
        this.radius = 34;
        this.circumference = 2 * Math.PI * this.radius;
    }

    update(items) {
        this.container.innerHTML = items.map(item => {
            const bounded = Math.max(0, Math.min(100, item.value));
            const dashOffset = this.circumference * (1 - (bounded / 100));

            return `
                <div class="ring-card">
                    <svg viewBox="0 0 100 100" class="progress-ring" aria-label="${item.label} ${Math.round(bounded)} percent">
                        <circle class="ring-bg" cx="50" cy="50" r="${this.radius}"></circle>
                        <circle class="ring-value" cx="50" cy="50" r="${this.radius}" style="stroke-dasharray:${this.circumference.toFixed(2)};stroke-dashoffset:${dashOffset.toFixed(2)}"></circle>
                    </svg>
                    <div class="ring-text">${Math.round(bounded)}%</div>
                    <div class="ring-label">${item.label}</div>
                </div>
            `;
        }).join('');
    }
}

class WeeklyTrendChart {
    constructor(ctx) {
        this.ctx = ctx;
        this.canvas = ctx.canvas;
    }

    update(labels, values) {
        const width = this.canvas.clientWidth || 600;
        const height = this.canvas.clientHeight || 240;
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.ctx.clearRect(0, 0, width, height);

        const padding = 24;
        const graphWidth = width - (padding * 2);
        const graphHeight = height - (padding * 2);
        const max = 100;
        const stepX = labels.length > 1 ? graphWidth / (labels.length - 1) : graphWidth;

        this.ctx.strokeStyle = 'rgba(229, 231, 235, 1)';
        this.ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(mark => {
            const y = padding + graphHeight - ((mark / max) * graphHeight);
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
        });

        this.ctx.beginPath();
        values.forEach((value, index) => {
            const x = padding + (stepX * index);
            const y = padding + graphHeight - ((value / max) * graphHeight);
            if (index === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.strokeStyle = '#6366f1';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        values.forEach((value, index) => {
            const x = padding + (stepX * index);
            const y = padding + graphHeight - ((value / max) * graphHeight);
            this.ctx.fillStyle = value >= 60 ? '#10b981' : '#ef4444';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#6b7280';
            this.ctx.font = '12px Segoe UI';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(labels[index], x, height - 6);
        });
    }
}

class StreakVisualizer {
    constructor(container) {
        this.container = container;
    }

    update(data) {
        const ratio = data.longest > 0 ? Math.min(100, (data.current / data.longest) * 100) : 0;
        this.container.innerHTML = `
            <div class="streak-fire">🔥 ${data.current} day streak</div>
            <div class="streak-track">
                <div class="streak-fill" style="width:${ratio}%"></div>
            </div>
            <div class="streak-meta">
                <span>Current: ${data.current}</span>
                <span>Best: ${data.longest}</span>
            </div>
        `;
    }
}

class HabitTracker {
    
    constructor() {
        this.freezeCharges = 0;
        this.maxFreezeCharges = 2;
        this.lastAwardedLevel = 1;
        this.frozenDates = [];
        this.onboardingStorageKey = 'habitOnboardingPrefs';
        this.onboardingCompletedKey = 'habitOnboardingCompleted';
        this.onboardingStep = 1;
        this.onboardingData = {
            goals: [],
            preferredTime: 'morning',
            difficulty: 'easy'
        };
        this.lastMotivationMessage = '';
        this.syncPendingKey = 'habitSyncPending';
        this.lastSyncedAtKey = 'habitLastSyncedAt';
        this.safetyBackupKey = 'habitSafetyBackup';
        this.habits = this.loadHabits();
        this.motivationalMessages = [
            'You are one small action away from progress 🌱',
            'Tiny wins build unstoppable momentum 💪',
            'Future you will thank you for this habit ✨',
            'Keep the streak warm—you have got this 🔥',
            'A gentle reminder: consistency beats intensity 🌟',
            'Progress over perfection, one checkmark at a time ✅',
            'You showed up today—this is how streaks are built 📈'
        ];
        this.lineChart = null;
        this.pieChart = null;
        this.weeklyTrendChart = null;
        this.monthlyAnalyticsChart = null;
        this.calendarHeatmap = null;
        this.progressRings = null;
        this.streakVisualizer = null;
        this.chartsInitialized = false;
        this.analyticsInitialized = false;
        this.lastHabitsMarkup = '';
        this.habitItemComponent = window.HabitItemComponent
            ? new window.HabitItemComponent({
                escapeHtml: (value) => this.escapeHtml(value),
                getHabitActionText: (habit, isCompleted) => this.getHabitActionText(habit, isCompleted),
                getProgressPercentage: (habit) => this.getProgressPercentage(habit),
                getBestReminderTime: (habit) => this.getBestReminderTime(habit)
            })
            : null;
        this.dashboardComponent = window.DashboardComponent ? new window.DashboardComponent() : null;
        this.currentExp = 0;
        this.expLevelSize = 100;
        this.currentChartRange = 7;
        this.currentMonth = new Date();
        this.lastCompletedHabitId = null;
        this.currentView = 'daily';
        this.selectedDate = this.getDateString(new Date());
        this.lastSaveTime = this.loadLastSaveTime();
        this.initializeEventListeners();
        this.initializeConnectivitySync();
        this.renderHabits();
        this.updateStats();
        this.setupLazyComponents();
        this.renderTopHabitsSidebar();
        this.updateExpBar();
        this.renderDailyView();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.updateAnalyticsDashboard();
        this.setupAutoSave();
        this.renderDailyChallenges();
        this.initializeReminderSystem();
        this.initializeOnboarding();
        this.updateMotivationPanel();
    }

    setupLazyComponents() {
        const chartsSection = document.getElementById('chartsSection');
        const analyticsView = document.getElementById('analyticsView');

        if (!('IntersectionObserver' in window)) {
            this.ensureChartsInitialized();
            this.ensureAnalyticsInitialized();
            return;
        }

        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                if (entry.target === chartsSection) {
                    this.ensureChartsInitialized();
                }

                if (entry.target === analyticsView) {
                    this.ensureAnalyticsInitialized();
                }

                lazyObserver.unobserve(entry.target);
            });
        }, { rootMargin: '200px' });

        if (chartsSection) lazyObserver.observe(chartsSection);
        if (analyticsView) lazyObserver.observe(analyticsView);
    }

    ensureChartsInitialized() {
        if (this.chartsInitialized) return;
        this.initializeCharts();
        this.chartsInitialized = true;
    }

    ensureAnalyticsInitialized() {
        if (this.analyticsInitialized) return;
        this.initializeAnalyticsCharts();
        this.analyticsInitialized = true;
        this.updateAnalyticsDashboard();
    }

    initializeReminderSystem() {
        this.habits = this.habits.map((habit) => this.normalizeHabitData(habit));
        this.checkReminders();
        setInterval(() => this.checkReminders(), 30 * 1000);
    }

    getDefaultReminderSettings() {
        return {
            enabled: false,
            time: '20:00',
            history: [],
            lastTriggeredDate: null
        };
    }

    normalizeHabitData(habit) {
        const normalized = { ...habit };
        normalized.type = normalized.type === 'quit' ? 'quit' : 'build';
        normalized.completedDates = Array.isArray(normalized.completedDates) ? normalized.completedDates : [];
        normalized.skippedDates = Array.isArray(normalized.skippedDates) ? normalized.skippedDates : [];
        normalized.completionTimestamps = Array.isArray(normalized.completionTimestamps) ? normalized.completionTimestamps : [];
        normalized.reminder = {
            ...this.getDefaultReminderSettings(),
            ...(normalized.reminder || {})
        };
        normalized.reminder.history = Array.isArray(normalized.reminder.history) ? normalized.reminder.history : [];
        return normalized;
    }

    initializeEventListeners() {
        document.getElementById('addBtn').addEventListener('click', () => this.addHabit());
        document.getElementById('habitInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addHabit();
        });
        document.getElementById('quickAddFab').addEventListener('click', () => this.focusQuickAdd());

        // Header buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.manualSave());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('sidebarExportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('sidebarImportBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('sidebarRestoreBtn').addEventListener('click', () => this.restoreSafetyBackup());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAllData());
        document.getElementById('sidebarResetBtn').addEventListener('click', () => this.resetAllData());
        document.getElementById('fileInput').addEventListener('change', (e) => this.importData(e));
        document.getElementById('sidebarToggleBtn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('routineMenuToggle')?.addEventListener('click', () => this.toggleRoutineMenu());
        document.getElementById('useFreezeBtn').addEventListener('click', () => this.useFreezeForToday());
        document.getElementById('refreshChallengesBtn').addEventListener('click', () => this.renderDailyChallenges());
        document.getElementById('nextActionBtn')?.addEventListener('click', () => this.handleNextAction());
        this.initializeMicroInteractions();

        // Routine view menu
        document.querySelectorAll('.routine-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // Quick actions
        document.getElementById('completeAllBtn').addEventListener('click', () => this.completeAllToday());
        document.getElementById('resetTodayBtn').addEventListener('click', () => this.resetTodayProgress());
        document.getElementById('sortBtn').addEventListener('click', () => this.sortByStreak());

        // Search and filter
        this.debouncedFilterHabits = debounce(() => this.filterHabits(), 180);
        document.getElementById('searchInput').addEventListener('input', this.debouncedFilterHabits);
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterHabits());

        // Chart range buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentChartRange = parseInt(e.currentTarget.dataset.range);
                this.updateLineChart();
            });
        });

        // Expand buttons
        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.expandChart(chartType);
            });
        });

        // Month navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.previousMonth());
        document.getElementById('nextMonth').addEventListener('click', () => this.nextMonth());

        // Help modal
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const helpCloseBtn = helpModal?.querySelector('.close');

        helpBtn?.addEventListener('click', () => {
            helpModal.classList.add('show');
        });

        helpCloseBtn?.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });

        // Day details modal
        const dayDetailsClose = document.querySelector('#dayDetailsModal .close');
        if (dayDetailsClose) {
            dayDetailsClose.addEventListener('click', () => {
                document.getElementById('dayDetailsModal').classList.remove('show');
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('helpModal')) {
                document.getElementById('helpModal').classList.remove('show');
            }
            if (e.target === document.getElementById('expandedModal')) {
                document.getElementById('expandedModal').classList.remove('show');
            }
            if (e.target === document.getElementById('dayDetailsModal')) {
                document.getElementById('dayDetailsModal').classList.remove('show');
            }
        });

        // Expanded modal close
        const closeExpanded = document.querySelector('.close-expanded');
        if (closeExpanded) {
            closeExpanded.addEventListener('click', () => {
                document.getElementById('expandedModal').classList.remove('show');
            });
        }

        // Onboarding controls
        document.getElementById('onboardingNextBtn')?.addEventListener('click', () => this.handleOnboardingNext());
        document.getElementById('onboardingBackBtn')?.addEventListener('click', () => this.handleOnboardingBack());
        document.getElementById('onboardingSkipBtn')?.addEventListener('click', () => this.finishOnboarding(true));
        document.querySelectorAll('#onboardingStep1 input[type="checkbox"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.syncOnboardingDataFromInputs();
                this.renderStarterPreview();
            });
        });
        document.querySelectorAll('input[name="onboardingTime"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.syncOnboardingDataFromInputs();
                this.renderStarterPreview();
            });
        });
        document.querySelectorAll('input[name="onboardingDifficulty"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.syncOnboardingDataFromInputs();
                this.renderStarterPreview();
            });
        });

        window.addEventListener('beforeunload', () => this.saveHabits());
        this.debouncedResizeHandler = debounce(() => {
            this.updateAnalyticsDashboard();
            this.syncResponsivePanels();
        }, 150);
        window.addEventListener('resize', this.debouncedResizeHandler);

        this.syncResponsivePanels();
    }


    initializeConnectivitySync() {
        updateNetworkStatusIndicator({ pendingSync: this.hasPendingSync() });

        window.addEventListener('online', () => {
            this.syncPendingChanges();
        });

        window.addEventListener('offline', () => {
            updateNetworkStatusIndicator({ online: false });
        });

        if (navigator.onLine) {
            this.syncPendingChanges({ silent: true });
        }
    }

    hasPendingSync() {
        return localStorage.getItem(this.syncPendingKey) === 'true';
    }

    markPendingSync() {
        localStorage.setItem(this.syncPendingKey, 'true');
        if (!navigator.onLine) {
            updateNetworkStatusIndicator({ online: false });
            return;
        }

        updateNetworkStatusIndicator({ online: true, pendingSync: true });
    }

    syncPendingChanges({ silent = false } = {}) {
        if (!navigator.onLine) {
            updateNetworkStatusIndicator({ online: false });
            return;
        }

        if (!this.hasPendingSync()) {
            updateNetworkStatusIndicator({ online: true, pendingSync: false });
            return;
        }

        updateNetworkStatusIndicator({ online: true, syncing: true });
        setTimeout(() => {
            localStorage.setItem(this.syncPendingKey, 'false');
            localStorage.setItem(this.lastSyncedAtKey, new Date().toISOString());
            updateNetworkStatusIndicator({ online: true, pendingSync: false });
            if (!silent) {
                this.showToast('✅ Local changes synced after reconnecting.', 'success');
            }
        }, 700);
    }

    switchView(view) {
        this.currentView = view;

        // Update button active state
        document.querySelectorAll('.routine-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Hide all views
        document.querySelectorAll('.routine-view').forEach(v => v.classList.add('hidden'));

        // Show selected view
        document.getElementById(`${view}View`).classList.remove('hidden');

        if (window.innerWidth < 768) {
            document.getElementById('routineNavLinks')?.classList.remove('open');
            document.getElementById('routineMenuToggle')?.setAttribute('aria-expanded', 'false');
        }

        if (view === 'daily') {
            setTimeout(() => this.autoFocusTodayHabit(), 80);
        }

        if (view === 'analytics') {
            this.ensureAnalyticsInitialized();
        }

        this.showToast(`Switched to ${view.charAt(0).toUpperCase() + view.slice(1)} view`, 'info');
    }


    toggleRoutineMenu() {
        const links = document.getElementById('routineNavLinks');
        const toggleBtn = document.getElementById('routineMenuToggle');
        if (!links || !toggleBtn) return;

        links.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(links.classList.contains('open')));
    }

    syncResponsivePanels() {
        const desktop = window.innerWidth >= 1024;
        document.querySelectorAll('.analytics-advanced').forEach((panel) => {
            panel.open = desktop;
        });
    }

    toggleSidebar() {
        document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', String(document.body.classList.contains('sidebar-collapsed')));
    }

    getConsistencyScore(habit) {
        const today = new Date();
        const lookbackDays = 14;
        let completedDays = 0;

        for (let i = 0; i < lookbackDays; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            if (habit.completedDates.includes(this.getDateString(date))) {
                completedDays++;
            }
        }

        return Math.round((completedDays / lookbackDays) * 100);
    }

    getMostImportantHabit() {
        if (this.habits.length === 0) return null;

        const openHabits = this.habits.filter((habit) => !this.isCompletedToday(habit));
        const pool = openHabits.length > 0 ? openHabits : this.habits;
        const scored = pool.map((habit) => {
            const consistency = this.getConsistencyScore(habit);
            const categoryBoost = habit.category === 'health' ? 8 : 0;
            const streakBoost = Math.min(40, (habit.streak || 0) * 3);
            const quitBoost = habit.type === 'quit' ? 5 : 0;
            const skippedPenalty = this.isSkippedToday(habit) ? -12 : 0;

            return {
                habit,
                score: consistency + categoryBoost + streakBoost + quitBoost + skippedPenalty
            };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.habit || null;
    }

    handleNextAction() {
        if (this.habits.length === 0) {
            this.focusQuickAdd();
            return;
        }

        const habit = this.getMostImportantHabit();
        if (!habit) return;

        if (this.currentView !== 'daily') {
            this.switchView('daily');
        }
        this.focusDailyHabit(habit.id);
    }

    focusDailyHabit(id) {
        const habitEl = document.querySelector(`.daily-habit-item[data-habit-id="${id}"]`);
        if (!habitEl) return;

        habitEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        habitEl.classList.add('habit-highlight');
        setTimeout(() => habitEl.classList.remove('habit-highlight'), 1200);
    }

    autoFocusTodayHabit() {
        const habit = this.getMostImportantHabit();
        if (!habit) return;
        this.focusDailyHabit(habit.id);
    }

    renderTopHabitsSidebar() {
        const topHabitsList = document.getElementById('topHabitsList');
        if (!topHabitsList) return;

        if (this.habits.length === 0) {
            topHabitsList.innerHTML = `
                <div class="habit-empty-state compact">
                    <div class="empty-illustration" aria-hidden="true">🌱</div>
                    <h3>Build your momentum</h3>
                    <p>${langManager.get('noHabits')}</p>
                    <div class="empty-state-actions">
                        <button class="quick-action-btn primary" onclick="app.focusQuickAdd()">Create your first habit</button>
                    </div>
                </div>
            `;
            return;
        }

        const topHabits = [...this.habits]
            .sort((a, b) => this.getConsistencyScore(b) - this.getConsistencyScore(a))
            .slice(0, 5);

        topHabitsList.innerHTML = topHabits.map(habit => `
            <button class="top-habit-item" onclick="app.focusHabit(${habit.id})">
                <span class="top-habit-name">${this.escapeHtml(habit.name)}</span>
                <span class="top-habit-score">${this.getConsistencyScore(habit)}%</span>
            </button>
        `).join('');
    }

    focusHabit(id) {
        const habitEl = document.querySelector(`.habit-item[data-habit-id="${id}"]`);
        if (!habitEl) return;

        habitEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        habitEl.classList.add('habit-highlight');
        setTimeout(() => habitEl.classList.remove('habit-highlight'), 1200);
    }

    // Daily View
    renderDailyView() {
        const dailyGrid = document.getElementById('dailyGrid');
        const nextActionText = document.getElementById('nextActionText');
        const nextActionBtn = document.getElementById('nextActionBtn');
        const today = new Date();
        document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        if (this.habits.length === 0) {
            dailyGrid.innerHTML = `
                <div class="habit-empty-state">
                    <div class="empty-illustration" aria-hidden="true">🚀</div>
                    <h3>Your habit journey starts today</h3>
                    <p>Add your first tiny habit and turn consistency into confidence.</p>
                    <div class="empty-state-actions">
                        <button class="quick-action-btn primary" onclick="app.focusQuickAdd()">Create your first habit</button>
                        <button class="quick-action-btn secondary" onclick="app.openGuidedSetup()">Use guided setup</button>
                    </div>
                </div>
            `;
            if (nextActionText) nextActionText.textContent = 'Create your first habit to start a focused routine.';
            if (nextActionBtn) nextActionBtn.textContent = 'Add habit';
            return;
        }

        const importantHabit = this.getMostImportantHabit();
        const pendingCount = this.habits.filter(habit => !this.isCompletedToday(habit)).length;

        if (nextActionText) {
            if (pendingCount === 0) {
                nextActionText.textContent = 'All habits completed today. Great work—review your streaks or plan tomorrow.';
            } else if (importantHabit) {
                nextActionText.textContent = `Focus now: ${importantHabit.name} (${pendingCount} pending today).`;
            }
        }
        if (nextActionBtn) {
            nextActionBtn.textContent = pendingCount === 0 ? 'Review habits' : 'Do next';
        }

        dailyGrid.innerHTML = this.habits.map(habit => {
            const isCompleted = this.isCompletedToday(habit);
            const isSkipped = this.isSkippedToday(habit);
            const typeMeta = this.getHabitTypeMeta(habit);
            const isJustCompleted = this.lastCompletedHabitId === habit.id && isCompleted;
            const isImportant = importantHabit?.id === habit.id;
            return `
                <div class="daily-habit-item ${isCompleted ? 'completed' : isSkipped ? 'skipped' : 'missed'} ${typeMeta.className} ${isJustCompleted ? 'just-completed' : ''} ${isImportant ? 'important-habit' : ''}" data-habit-id="${habit.id}">
                    <div class="daily-main-action" onclick="app.toggleHabitCompletion(${habit.id})">
                        <div class="daily-habit-name">${this.escapeHtml(habit.name)}${isImportant ? '<span class="priority-chip">Top priority</span>' : ''}</div>
                        <div class="habit-type-chip ${typeMeta.className}">${typeMeta.icon} ${typeMeta.label}</div>
                        <div class="daily-habit-category ${habit.category}">${habit.category}</div>
                    </div>
                    <div class="daily-actions">
                    <button class="daily-check-btn ${isCompleted ? 'completed' : ''} ${typeMeta.className}" 
                            onclick="app.toggleHabitCompletion(${habit.id})">
                        ${this.getHabitActionText(habit, isCompleted)}
                    </button>
                    <button class="daily-skip-btn ${isSkipped ? 'active' : ''}" onclick="app.skipHabitToday(${habit.id})">
                        ${isSkipped ? 'Skipped' : 'Skip'}
                    </button>
                    </div>
                </div>
            `;
        }).join('');
        this.initializeSwipeActions();
        if (this.currentView === 'daily') {
            this.autoFocusTodayHabit();
        }
    }

    // Weekly Tracker
    renderWeeklyTracker() {
        const weeklyGrid = document.getElementById('weeklyGrid');
        const today = new Date();
        const weeklyData = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Get last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = this.getDateString(date);
            const dayName = days[date.getDay()];
            
            const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
            const total = this.habits.length;

            weeklyData[dayName] = {
                date: dateStr,
                completed: completed,
                total: total,
                displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
        }

        weeklyGrid.innerHTML = Object.entries(weeklyData).map(([dayName, data]) => {
            const isCompleted = data.completed === data.total && data.total > 0;
            return `
                <div class="day-card ${isCompleted ? 'completed' : ''}" 
                     onclick="app.showDayDetails('${data.date}', '${dayName}')">
                    <div class="day-name">${dayName}</div>
                    <div class="day-date">${data.displayDate}</div>
                    <div class="day-stats">${data.completed}/${data.total}</div>
                    <div class="day-label">completed</div>
                </div>
            `;
        }).join('');
    }

    // Monthly Tracker
    renderMonthlyTracker() {
        const monthlyGrid = document.getElementById('monthlyGrid');
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // Update month display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

        // Get first day and last day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '';
        
        // Add weekday headers
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            html += `<div class="weekday-header">${day}</div>`;
        });

        // Add dates
        let currentDate = new Date(startDate);
        const today = new Date();
        const todayStr = this.getDateString(today);

        while (currentDate <= lastDay || currentDate.getDay() !== 0) {
            const dateStr = this.getDateString(currentDate);
            const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
            const total = this.habits.length;
            const isOtherMonth = currentDate.getMonth() !== month;
            const isToday = dateStr === todayStr;

            let className = 'date-cell';
            if (isOtherMonth) className += ' other-month';
            if (isToday) className += ' today';
            if (completed === total && total > 0) className += ' completed';
            else if (completed > 0) className += ' partial';

            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];

            html += `
                <div class="${className}" 
                     onclick="app.showDayDetails('${dateStr}', '${dayName}')"
                     title="${dateStr}">
                    <span class="date-day">${currentDate.getDate()}</span>
                    ${total > 0 ? `<span class="date-count">${completed}/${total}</span>` : ''}
                </div>
            `;

            currentDate.setDate(currentDate.getDate() + 1);
        }

        monthlyGrid.innerHTML = html;
    }

    showDayDetails(dateStr, dayName) {
        const modal = document.getElementById('dayDetailsModal');
        const dateObj = new Date(dateStr);
        
        // Format date
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        document.getElementById('detailsDate').textContent = formattedDate;

        // Get habits for this day
        const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
        const total = this.habits.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('detailsCompleted').textContent = completed;
        document.getElementById('detailsTotal').textContent = total;
        document.getElementById('detailsRate').textContent = rate + '%';

        // List habits
        const habitsList = document.getElementById('dayHabitsList');
        habitsList.innerHTML = this.habits.map(habit => {
            const isCompleted = habit.completedDates.includes(dateStr);
            const typeMeta = this.getHabitTypeMeta(habit);
            return `
                <div class="day-habit-detail ${isCompleted ? 'completed' : ''} ${typeMeta.className}">
                    <div class="day-habit-detail-name">
                        <div class="day-habit-detail-title">${this.escapeHtml(habit.name)}</div>
                        <span class="habit-type-chip ${typeMeta.className}">${typeMeta.icon} ${typeMeta.label}</span>
                        <span class="day-habit-detail-cat ${habit.category}">${habit.category}</span>
                    </div>
                    <span class="day-habit-status ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? this.getHabitActionText(habit, true) : 'Pending'}
                    </span>
                </div>
            `;
        }).join('');

        modal.classList.add('show');
    }

    previousMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        this.renderMonthlyTracker();
    }

    nextMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        this.renderMonthlyTracker();
    }

    // Chart Expansion
    expandChart(chartType) {
        const modal = document.getElementById('expandedModal');
        const container = document.getElementById('expandedChartContainer');
        const title = document.getElementById('expandedTitle');

        modal.classList.add('show');

        if (chartType === 'line') {
            if (typeof Chart === 'undefined') {
                title.textContent = 'Progress Analytics';
                container.innerHTML = '<p class="empty-message">Line chart unavailable (Chart.js failed to load).</p>';
                return;
            }
            title.textContent = `Progress Analytics (${this.currentChartRange} Days)`;
            const canvas = document.createElement('canvas');
            canvas.id = 'expandedLineChart';
            container.innerHTML = '';
            container.appendChild(canvas);
            
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: this.getLineChartData(this.currentChartRange),
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    font: { size: 14, weight: '600' },
                                    color: '#6b7280',
                                    padding: 20
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: this.habits.length || 1,
                                ticks: {
                                    stepSize: 1,
                                    color: '#6b7280',
                                    font: { size: 12 }
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#6b7280', font: { size: 12 } }
                            }
                        }
                    }
                });
            }, 100);

        } else if (chartType === 'pie') {
            if (typeof Chart === 'undefined') {
                title.textContent = "Today's Completion Rate";
                container.innerHTML = '<p class="empty-message">Pie chart unavailable (Chart.js failed to load).</p>';
                return;
            }
            title.textContent = "Today's Completion Rate";
            const canvas = document.createElement('canvas');
            canvas.id = 'expandedPieChart';
            container.innerHTML = '';
            container.appendChild(canvas);
            
            setTimeout(() => {
                const today = this.getDateString(new Date());
                const completed = this.habits.filter(h => h.completedDates.includes(today)).length;
                const pending = this.habits.length - completed;

                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Completed', 'Pending'],
                        datasets: [{
                            data: [completed, pending],
                            backgroundColor: ['#10b981', '#f59e0b'],
                            borderColor: ['#ffffff', '#ffffff'],
                            borderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    font: { size: 14, weight: '600' },
                                    color: '#6b7280',
                                    padding: 20
                                }
                            }
                        }
                    }
                });
            }, 100);

        } else if (chartType === 'weekly') {
            title.textContent = 'Weekly Routine';
            const weeklyData = [];
            const today = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = this.getDateString(date);
                const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
                weeklyData.push({
                    day: days[date.getDay()],
                    completed: completed,
                    total: this.habits.length,
                    date: dateStr
                });
            }

            container.innerHTML = `
                <div style="padding: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                        ${weeklyData.map(data => `
                            <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1)); padding: 20px; border-radius: 12px; text-align: center; border: 2px solid #e5e7eb; cursor: pointer;" onclick="app.showDayDetails('${data.date}', '${data.day}')">
                                <div style="font-weight: 600; color: #1f2937; margin-bottom: 10px;">${data.day}</div>
                                <div style="font-size: 1.8rem; font-weight: 700; color: #6366f1; margin-bottom: 5px;">${data.completed}/${data.total}</div>
                                <div style="font-size: 0.85rem; color: #6b7280;">completed</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

        } else if (chartType === 'monthly') {
            title.textContent = `Monthly Routine - ${new Date(this.currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
            const monthlyData = [];
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay());

            let html = '<div style="padding: 20px;"><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">';
            
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            weekdays.forEach(day => {
                html += `<div style="text-align: center; font-weight: 600; color: #6b7280; padding: 10px;">${day}</div>`;
            });

            let currentDate = new Date(startDate);
            const today = new Date();
            const todayStr = this.getDateString(today);

            while (currentDate <= lastDay || currentDate.getDay() !== 0) {
                const dateStr = this.getDateString(currentDate);
                const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
                const total = this.habits.length;
                const isOtherMonth = currentDate.getMonth() !== month;
                const isToday = dateStr === todayStr;
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];

                let bgColor = '#f9fafb';
                let borderColor = '#e5e7eb';
                if (isOtherMonth) bgColor = '#f3f4f6';
                else if (completed === total && total > 0) {
                    bgColor = 'rgba(16, 185, 129, 0.2)';
                    borderColor = '#10b981';
                } else if (completed > 0) {
                    bgColor = 'rgba(245, 158, 11, 0.2)';
                    borderColor = '#f59e0b';
                }

                html += `
                    <div style="aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 8px; font-size: 0.9rem; font-weight: ${isToday ? '700' : '600'}; cursor: pointer;" 
                         onclick="app.showDayDetails('${dateStr}', '${dayName}')">
                        <span>${currentDate.getDate()}</span>
                        ${total > 0 ? `<span style="font-size: 0.75rem; opacity: 0.7;">${completed}/${total}</span>` : ''}
                    </div>
                `;

                currentDate.setDate(currentDate.getDate() + 1);
            }

            html += '</div></div>';
            container.innerHTML = html;
        }
    }

    initializeCharts() {
        if (typeof Chart === 'undefined') {
            this.lineChart = null;
            this.pieChart = null;
            this.showChartUnavailableState('progressChart', 'Line chart unavailable (Chart.js failed to load).');
            this.showChartUnavailableState('completionChart', 'Pie chart unavailable (Chart.js failed to load).');
            return;
        }
        this.initializeLineChart();
        this.initializePieChart();
    }

    showChartUnavailableState(canvasId, message) {
        const canvas = document.getElementById(canvasId);
        const container = canvas?.parentElement;
        if (!container) return;
        container.innerHTML = `<p class="empty-message">${this.escapeHtml(message)}</p>`;
    }

    initializeLineChart() {
        const chartCanvas = document.getElementById('progressChart');
        if (!chartCanvas || typeof Chart === 'undefined') return;

        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;

        if (this.lineChart) {
            this.lineChart.destroy();
        }

        this.lineChart = new Chart(ctx, {
            type: 'line',
            data: this.getLineChartData(this.currentChartRange),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 12, weight: '600' },
                            color: '#6b7280',
                            padding: 15
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: this.habits.length || 1,
                        ticks: {
                            stepSize: 1,
                            color: '#6b7280'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b7280' }
                    }
                }
            }
        });

    }

    initializePieChart() {
        const chartCanvas = document.getElementById('completionChart');
        if (!chartCanvas || typeof Chart === 'undefined') return;

        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;

        if (this.pieChart) {
            this.pieChart.destroy();
        }

        const today = this.getDateString(new Date());
        const completed = this.habits.filter(h => h.completedDates.includes(today)).length;
        const pending = this.habits.length - completed;

        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderColor: ['#ffffff', '#ffffff'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    getLineChartData(days) {
        const labels = [];
        const completionData = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = this.getDateString(date);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

            const completedCount = this.habits.filter(habit => 
                habit.completedDates.includes(dateStr)
            ).length;
            completionData.push(completedCount);
        }

        return {
            labels: labels,
            datasets: [{
                label: 'Habits Completed',
                data: completionData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }]
        };
    }

    updateCharts() {
        this.ensureChartsInitialized();
        this.updateLineChart();
        this.updatePieChart();
        this.updateAnalyticsDashboard();
    }

    updateLineChart() {
        if (this.lineChart) {
            this.lineChart.data = this.getLineChartData(this.currentChartRange);
            this.lineChart.update();
        }
    }

    updatePieChart() {
        if (this.pieChart) {
            const today = this.getDateString(new Date());
            const completed = this.habits.filter(h => h.completedDates.includes(today)).length;
            const pending = this.habits.length - completed;
            
            this.pieChart.data.datasets[0].data = [completed, pending];
            this.pieChart.update();
        }
    }


    initializeAnalyticsCharts() {
        if (typeof Chart === 'undefined') {
            this.monthlyAnalyticsChart = null;
            return;
        }

        const weeklyCtx = document.getElementById('weeklyTrendCanvas')?.getContext('2d');
        const monthlyCtx = document.getElementById('monthlyAnalyticsChart')?.getContext('2d');
        const heatmapContainer = document.getElementById('calendarHeatmap');
        const ringsContainer = document.getElementById('progressRings');
        const streakContainer = document.getElementById('streakVisual');

        if (heatmapContainer) {
            this.calendarHeatmap = new CalendarHeatmap(heatmapContainer);
        }

        if (ringsContainer) {
            this.progressRings = new ProgressRings(ringsContainer);
        }

        if (streakContainer) {
            this.streakVisualizer = new StreakVisualizer(streakContainer);
        }

        if (weeklyCtx) {
            this.weeklyTrendChart = new WeeklyTrendChart(weeklyCtx);
        }

        if (monthlyCtx) {
            this.monthlyAnalyticsChart = new Chart(monthlyCtx, {
                type: 'line',
                data: this.getMonthlyAnalyticsData(),
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        }
    }

    getWeeklyAnalyticsData() {
        const today = new Date();
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayTotals = Array(7).fill(0);
        const dayPossible = Array(7).fill(0);

        for (let i = 0; i < 28; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dayIndex = date.getDay();
            const dateStr = this.getDateString(date);

            dayPossible[dayIndex] += this.habits.length;
            dayTotals[dayIndex] += this.habits.filter(h => h.completedDates.includes(dateStr)).length;
        }

        const completionRates = dayTotals.map((count, index) =>
            dayPossible[index] > 0 ? Math.round((count / dayPossible[index]) * 100) : 0
        );

        return {
            labels,
            datasets: [{
                data: completionRates,
                backgroundColor: '#6366f1'
            }]
        };
    }

    getMonthlyAnalyticsData() {
        const now = new Date();
        const labels = [];
        const data = [];

        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' });
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let completed = 0;
            let possible = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                if (date > now) break;

                const dateStr = this.getDateString(date);
                possible += this.habits.length;
                completed += this.habits.filter(h => h.completedDates.includes(dateStr)).length;
            }

            labels.push(monthLabel);
            data.push(possible > 0 ? Math.round((completed / possible) * 100) : 0);
        }

        return {
            labels,
            datasets: [{
                data,
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                fill: true,
                tension: 0.35
            }]
        };
    }

    calculateLongestStreak() {
        let longest = 0;

        this.habits.forEach(habit => {
            const dates = [...new Set(habit.completedDates)]
                .map(date => new Date(date))
                .sort((a, b) => a - b);

            let current = 0;
            let prev = null;

            dates.forEach(date => {
                if (!prev) {
                    current = 1;
                } else {
                    const diff = Math.round((date - prev) / (1000 * 60 * 60 * 24));
                    current = diff === 1 ? current + 1 : 1;
                }
                longest = Math.max(longest, current);
                prev = date;
            });
        });

        return longest;
    }

    getAnalyticsInsights(weeklyRates) {
        const insights = [];
        const weekdayAvg = Math.round((weeklyRates.slice(1, 6).reduce((sum, v) => sum + v, 0)) / 5);
        const weekendAvg = Math.round((weeklyRates[0] + weeklyRates[6]) / 2);

        if (weekdayAvg > weekendAvg + 10) {
            insights.push('You are most consistent on weekdays.');
        } else if (weekendAvg > weekdayAvg + 10) {
            insights.push('You perform better on weekends.');
        }

        const sundayRate = weeklyRates[0] || 0;
        if (sundayRate <= 40) {
            insights.push('Your streak drops on Sundays. Consider a lighter Sunday habit.');
        }

        const strongestDayIndex = weeklyRates.indexOf(Math.max(...weeklyRates));
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        insights.push(`Your strongest day is ${dayNames[strongestDayIndex]}.`);

        if (insights.length === 1) {
            insights.push('Your completion pattern is steady. Keep your current routine.');
        }

        return insights;
    }

    updateAnalyticsDashboard() {
        const completionRate = this.calculateSuccessRate();
        const currentStreak = this.calculateOverallStreak();
        const longestStreak = this.calculateLongestStreak();

        const completionEl = document.getElementById('analyticsCompletionRate');
        const currentEl = document.getElementById('analyticsCurrentStreak');
        const longestEl = document.getElementById('analyticsLongestStreak');

        if (completionEl) completionEl.textContent = `${Math.round(completionRate)}%`;
        if (currentEl) currentEl.textContent = `${currentStreak} day${currentStreak === 1 ? '' : 's'}`;
        if (longestEl) longestEl.textContent = `${longestStreak} day${longestStreak === 1 ? '' : 's'}`;

        const weeklyData = this.getWeeklyAnalyticsData();
        const monthlyData = this.getMonthlyAnalyticsData();

        if (this.weeklyTrendChart) {
            this.weeklyTrendChart.update(weeklyData.labels, weeklyData.datasets[0].data || []);
        }

        if (this.monthlyAnalyticsChart) {
            this.monthlyAnalyticsChart.data = monthlyData;
            this.monthlyAnalyticsChart.update();
        }

        const insightsEl = document.getElementById('analyticsInsights');
        if (insightsEl) {
            const insights = this.getAnalyticsInsights(weeklyData.datasets[0].data || []);
            insightsEl.innerHTML = insights.map(item => `<li>${this.escapeHtml(item)}</li>`).join('');
        }

        if (this.calendarHeatmap) {
            this.calendarHeatmap.update(this.getHeatmapData());
        }

        if (this.progressRings) {
            this.progressRings.update(this.getProgressRingData());
        }

        if (this.streakVisualizer) {
            this.streakVisualizer.update(this.getStreakVisualData());
        }
    }

    getHeatmapData(days = 84) {
        const cells = [];
        const today = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = this.getDateString(date);
            const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
            const missed = Math.max(0, this.habits.length - completed);
            const ratio = this.habits.length ? completed / this.habits.length : 0;

            cells.push({
                date: dateStr,
                label: `${dayNames[date.getDay()]} ${dateStr}`,
                completed,
                missed,
                ratio
            });
        }

        return cells;
    }

    getProgressRingData() {
        const totalHabits = this.habits.length;
        const today = this.getDateString(new Date());
        const completedToday = this.habits.filter(h => h.completedDates.includes(today)).length;
        const completionRate = this.calculateSuccessRate();
        const weeklyAverage = this.calculateWeeklyAverage();

        return [
            {
                label: 'Today',
                value: totalHabits ? (completedToday / totalHabits) * 100 : 0
            },
            {
                label: 'Weekly Avg',
                value: weeklyAverage
            },
            {
                label: 'Overall',
                value: completionRate
            }
        ];
    }

    getStreakVisualData() {
        return {
            current: this.calculateOverallStreak(),
            longest: this.calculateLongestStreak()
        };
    }

    addHabit() {
        const input = document.getElementById('habitInput');
        const category = document.getElementById('categorySelect').value;
        const type = document.getElementById('habitTypeSelect').value === 'quit' ? 'quit' : 'build';
        const habitName = input.value.trim();

        if (!habitName) {
            this.showToast('Please enter a habit name', 'error');
            return;
        }

        const newHabit = {
            id: Date.now(),
            name: habitName,
            category: category,
            type,
            createdDate: new Date().toISOString(),
            completedDates: [],
            skippedDates: [],
            completionTimestamps: [],
            reminder: this.getDefaultReminderSettings(),
            streak: 0
        };

        this.habits.push(newHabit);
        this.saveHabits();
        this.renderHabits();
        this.renderDailyView();
        this.updateStats();
        this.updateCharts();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.renderDailyChallenges();

        input.value = '';
        input.focus();
        const createdLabel = type === 'quit' ? 'quit' : 'build';
        this.showToast(`✅ ${createdLabel.charAt(0).toUpperCase() + createdLabel.slice(1)} habit "${habitName}" added successfully!`, 'success');
    }

    deleteHabit(id) {
        const habit = this.habits.find(h => h.id === id);
        if (confirm(`Are you sure you want to delete "${habit.name}"?`)) {
            this.habits = this.habits.filter(habit => habit.id !== id);
            this.saveHabits();
            this.renderHabits();
            this.renderDailyView();
            this.updateStats();
            this.updateCharts();
            this.renderWeeklyTracker();
            this.renderMonthlyTracker();
            this.renderDailyChallenges();
            this.showToast('Habit deleted', 'success');
        }
    }

    toggleHabitCompletion(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        const today = this.getDateString(new Date());
        const index = habit.completedDates.indexOf(today);

        if (index > -1) {
            habit.completedDates.splice(index, 1);
            this.lastCompletedHabitId = null;
            habit.completionTimestamps = habit.completionTimestamps.filter((isoTs) => !isoTs.startsWith(today));
            this.showToast(this.getHabitTypeMessage(habit, 'reset'), 'info');
        } else {
            habit.completedDates.push(today);
            this.lastCompletedHabitId = habit.id;
            habit.skippedDates = habit.skippedDates.filter(date => date !== today);
            habit.completionTimestamps.push(new Date().toISOString());
            this.showToast(this.getHabitTypeMessage(habit, 'success'), 'success');
            this.setRandomMotivationMessage();
            this.triggerCelebration();
            setTimeout(() => {
                this.lastCompletedHabitId = null;
                this.renderDailyView();
                this.renderHabits();
            }, 650);
        }

        habit.streak = this.calculateStreak(habit);
        this.saveHabits();
        this.renderHabits();
        this.renderDailyView();
        this.updateStats();
        this.updateCharts();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.renderDailyChallenges();
    }

    completeAllToday() {
        const today = this.getDateString(new Date());
        let count = 0;

        this.habits.forEach(habit => {
            if (!habit.completedDates.includes(today)) {
                habit.completedDates.push(today);
                habit.completionTimestamps.push(new Date().toISOString());
                habit.streak = this.calculateStreak(habit);
                count++;
            }
        });

        if (count > 0) {
            this.saveHabits();
            this.renderHabits();
            this.renderDailyView();
            this.updateStats();
            this.updateCharts();
            this.renderWeeklyTracker();
            this.renderMonthlyTracker();
            this.renderDailyChallenges();
            this.setRandomMotivationMessage(true);
            this.triggerCelebration();
            this.showToast(`✅ Completed ${count} habits!`, 'success');
        } else {
            this.showToast('All habits already completed today!', 'info');
        }
    }

    resetTodayProgress() {
        if (confirm('Reset all habits for today?')) {
            const today = this.getDateString(new Date());
            this.habits.forEach(habit => {
                const index = habit.completedDates.indexOf(today);
                if (index > -1) {
                    habit.completedDates.splice(index, 1);
                    habit.completionTimestamps = habit.completionTimestamps.filter((isoTs) => !isoTs.startsWith(today));
                    habit.streak = this.calculateStreak(habit);
                }
            });

            this.saveHabits();
            this.renderHabits();
            this.renderDailyView();
            this.updateStats();
            this.updateCharts();
            this.renderWeeklyTracker();
            this.renderMonthlyTracker();
            this.renderDailyChallenges();
            this.showToast("Today's progress reset", 'success');
        }
    }

    sortByStreak() {
        this.habits.sort((a, b) => b.streak - a.streak);
        this.renderHabits();
        this.renderDailyView();
        this.showToast('Sorted by streak!', 'info');
    }

    filterHabits() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;

        document.querySelectorAll('.habit-item').forEach(item => {
            const habitName = item.dataset.habitName || '';
            const habitCategory = item.dataset.habitCategory || '';
            const matchesSearch = habitName.includes(searchTerm);
            const matchesCategory = categoryFilter === 'all' || habitCategory === categoryFilter;
            item.classList.toggle('hidden', !(matchesSearch && matchesCategory));
        });
    }

    calculateStreak(habit) {
        if (habit.completedDates.length === 0) return 0;

        const completedSet = new Set(habit.completedDates);
        let streak = 0;
        let currentDate = new Date();

        while (true) {
            const dateStr = this.getDateString(currentDate);
            const done = completedSet.has(dateStr);
            const frozen = this.frozenDates.includes(dateStr);

            if (!done && !frozen) {
                break;
            }
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return streak;
    }

    isCompletedToday(habit) {
        const today = this.getDateString(new Date());
        return habit.completedDates.includes(today);
    }

    isSkippedToday(habit) {
        const today = this.getDateString(new Date());
        return (habit.skippedDates || []).includes(today);
    }

    skipHabitToday(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        const today = this.getDateString(new Date());
        habit.skippedDates = Array.isArray(habit.skippedDates) ? habit.skippedDates : [];
        const skipIndex = habit.skippedDates.indexOf(today);

        if (skipIndex > -1) {
            habit.skippedDates.splice(skipIndex, 1);
            this.showToast(`Removed skip for "${habit.name}"`, 'info');
        } else {
            habit.skippedDates.push(today);
            habit.completedDates = habit.completedDates.filter(date => date !== today);
            habit.completionTimestamps = habit.completionTimestamps.filter((isoTs) => !isoTs.startsWith(today));
            this.showToast(`⏭️ "${habit.name}" skipped for today`, 'info');
        }

        habit.streak = this.calculateStreak(habit);
        this.saveHabits();
        this.renderHabits();
        this.renderDailyView();
        this.updateStats();
        this.updateCharts();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.renderDailyChallenges();
    }

    focusQuickAdd() {
        const input = document.getElementById('habitInput');
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.select();
    }

    openGuidedSetup() {
        const modal = document.getElementById('onboardingModal');
        if (!modal) return;

        this.onboardingStep = 1;
        this.syncOnboardingInputsFromData();
        this.updateOnboardingUI();
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    initializeMicroInteractions() {
        document.addEventListener('pointerdown', (event) => {
            const button = event.target.closest('button, .quick-action-btn');
            if (button) {
                button.classList.add('pressing');
            }
        });

        document.addEventListener('pointerup', () => {
            document.querySelectorAll('.pressing').forEach((btn) => btn.classList.remove('pressing'));
        });

        document.addEventListener('pointercancel', () => {
            document.querySelectorAll('.pressing').forEach((btn) => btn.classList.remove('pressing'));
        });
    }

    initializeSwipeActions() {
        const cards = document.querySelectorAll('.daily-habit-item');
        cards.forEach(card => {
            let startX = 0;
            card.addEventListener('touchstart', (event) => {
                startX = event.changedTouches[0].clientX;
            }, { passive: true });

            card.addEventListener('touchend', (event) => {
                const endX = event.changedTouches[0].clientX;
                const deltaX = endX - startX;
                const habitId = Number(card.dataset.habitId);

                if (Math.abs(deltaX) < 70 || !habitId) return;
                if (deltaX > 0) {
                    this.toggleHabitCompletion(habitId);
                } else {
                    this.skipHabitToday(habitId);
                }
            }, { passive: true });
        });
    }

    getHabitTypeMeta(habit) {
        if (habit.type === 'quit') {
            return { icon: '🛑', label: 'Quit', className: 'quit' };
        }

        return { icon: '🟢', label: 'Build', className: 'build' };
    }

    getHabitActionText(habit, isCompleted = this.isCompletedToday(habit)) {
        if (habit.type === 'quit') {
            return isCompleted ? '✓ Avoided' : 'Mark Avoided';
        }
        return isCompleted ? '✓ Done' : 'Mark Done';
    }

    getHabitTypeMessage(habit, messageType) {
        if (habit.type === 'quit') {
            if (messageType === 'success') return `✅ Great discipline! You avoided "${habit.name}" today.`;
            if (messageType === 'reset') return `${habit.name} avoidance was reset for today`;
        }

        if (messageType === 'success') return `✅ Great! ${habit.name} completed!`;
        if (messageType === 'reset') return `${habit.name} marked incomplete`;
        return 'Habit updated';
    }

    getDateString(date) {
        return date.toISOString().split('T')[0];
    }

    getProgressPercentage(habit) {
        if (habit.completedDates.length === 0) return 0;
        
        const createdDate = new Date(habit.createdDate);
        const today = new Date();
        const daysSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24)) + 1;
        
        return Math.min(100, Math.round((habit.completedDates.length / daysSinceCreation) * 100));
    }

    renderHabits() {
        const habitsList = document.getElementById('habitsList');
        
        if (this.habits.length === 0) {
            this.lastHabitsMarkup = '';
            habitsList.innerHTML = `
                <div class="habit-empty-state">
                    <div class="empty-illustration" aria-hidden="true">✨</div>
                    <h3>No habits yet, but your progress can start now</h3>
                    <p>Pick one small habit and let daily wins compound over time.</p>
                    <div class="empty-state-actions">
                        <button class="quick-action-btn primary" onclick="app.focusQuickAdd()">Create your first habit</button>
                        <button class="quick-action-btn secondary" onclick="app.openGuidedSetup()">Use guided setup</button>
                    </div>
                </div>
            `;
            return;
        }

        const importantHabit = this.getMostImportantHabit();
        const nextMarkup = this.habits.map((habit) => {
            const isCompleted = this.isCompletedToday(habit);
            const typeMeta = this.getHabitTypeMeta(habit);
            const isJustCompleted = this.lastCompletedHabitId === habit.id && isCompleted;
            const isImportant = importantHabit?.id === habit.id;

            if (this.habitItemComponent) {
                return this.habitItemComponent.render(habit, {
                    isCompleted,
                    isImportant,
                    isJustCompleted,
                    typeMeta
                });
            }

            return `<div class="habit-item">${this.escapeHtml(habit.name)}</div>`;
        }).join('');

        if (this.lastHabitsMarkup !== nextMarkup) {
            habitsList.innerHTML = nextMarkup;
            this.lastHabitsMarkup = nextMarkup;
        }

        this.filterHabits();
    }

    toggleReminderEdit(id) {
        const panel = document.getElementById(`reminderEditor-${id}`);
        if (panel) panel.classList.toggle('hidden');
    }

    saveReminderSettings(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        const timeInput = document.getElementById(`reminderTime-${id}`);
        const enabledInput = document.getElementById(`reminderEnabled-${id}`);
        habit.reminder.time = timeInput?.value || habit.reminder.time;
        habit.reminder.enabled = !!enabledInput?.checked;

        this.saveHabits();
        this.renderHabits();
        this.showToast(`Reminder updated for ${habit.name}`, 'success');
    }

    applySuggestedReminder(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;
        const suggestion = this.getBestReminderTime(habit);
        const timeInput = document.getElementById(`reminderTime-${id}`);
        if (timeInput) timeInput.value = suggestion;
    }

    getBestReminderTime(habit) {
        const timestamps = (habit.completionTimestamps || [])
            .map((ts) => new Date(ts))
            .filter((date) => !Number.isNaN(date.getTime()));

        if (timestamps.length < 3) {
            return habit.reminder?.time || '20:00';
        }

        const minutes = timestamps
            .map((date) => date.getHours() * 60 + date.getMinutes())
            .sort((a, b) => a - b);
        const medianMinutes = minutes[Math.floor(minutes.length / 2)];
        const hours = String(Math.floor(medianMinutes / 60)).padStart(2, '0');
        const mins = String(medianMinutes % 60).padStart(2, '0');
        return `${hours}:${mins}`;
    }

    requestNotificationPermission() {
        if (!('Notification' in window)) {
            this.showToast('This browser does not support notifications.', 'error');
            return;
        }

        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                this.showToast('Browser notifications enabled!', 'success');
            } else {
                this.showToast('Notification permission was not granted.', 'info');
            }
        });
    }

    checkReminders() {
        const now = new Date();
        const today = this.getDateString(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        this.habits.forEach((habit) => {
            const reminder = habit.reminder || this.getDefaultReminderSettings();
            if (!reminder.enabled) return;
            if (habit.completedDates.includes(today)) return;

            const [hours, mins] = (reminder.time || '20:00').split(':').map(Number);
            const reminderMinutes = (hours * 60) + mins;
            if (currentMinutes < reminderMinutes) return;
            if (reminder.lastTriggeredDate === today) return;

            this.sendHabitReminder(habit);
            habit.reminder.lastTriggeredDate = today;
        });

        this.saveHabits();
    }

    sendHabitReminder(habit) {
        const message = this.motivationalMessages[Math.floor(Math.random() * this.motivationalMessages.length)];
        const actionPrompt = habit.type === 'quit'
            ? `Stay strong and avoid "${habit.name}" today.`
            : `Time to complete "${habit.name}".`;
        const body = `${actionPrompt} ${message}`;

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Habit reminder', { body });
        } else {
            this.showToast(`🔔 ${body}`, 'info');
        }

        habit.reminder.history.push({
            triggeredAt: new Date().toISOString(),
            message: body
        });
        habit.reminder.history = habit.reminder.history.slice(-30);
    }

    updateStats() {
        const totalHabits = this.habits.length;
        const today = this.getDateString(new Date());
        const completedToday = this.habits.filter(h => h.completedDates.includes(today)).length;
        const overallStreak = this.calculateOverallStreak();

        const weeklyAverage = this.calculateWeeklyAverage();

        if (this.dashboardComponent) {
            this.dashboardComponent.renderStats({
                totalHabits,
                completedToday,
                overallStreak,
                weeklyAverage
            });
        } else {
            document.getElementById('totalHabits').textContent = totalHabits;
            document.getElementById('completedToday').textContent = completedToday;
            document.getElementById('currentStreak').textContent = overallStreak;
            document.getElementById('weeklyAverage').textContent = Math.round(weeklyAverage) + '%';
        }

        this.updateInsights();
        this.updateExpBar();
        this.updateMotivationPanel();
        this.renderTopHabitsSidebar();
        this.updateAnalyticsDashboard();
    }

    calculatePerfectDayStreak() {
        if (this.habits.length === 0) return 0;

        let streak = 0;
        let cursor = new Date();

        while (true) {
            const dateStr = this.getDateString(cursor);
            const completed = this.habits.filter(h => h.completedDates.includes(dateStr)).length;
            const isPerfect = completed === this.habits.length;
            if (!isPerfect) break;
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return streak;
    }

    updateMotivationPanel() {
        const streakEl = document.getElementById('dailyStreakValue');
        const badgeEl = document.getElementById('perfectDayBadge');
        const messageEl = document.getElementById('motivationMessage');
        const levelEl = document.getElementById('levelValue');
        if (!streakEl || !badgeEl || !messageEl || !levelEl) return;

        const today = this.getDateString(new Date());
        const completedToday = this.habits.filter(h => h.completedDates.includes(today)).length;
        const perfectDay = this.habits.length > 0 && completedToday === this.habits.length;
        const perfectStreak = this.calculatePerfectDayStreak();
        const level = Math.floor(this.currentExp / this.expLevelSize) + 1;

        if (!this.lastMotivationMessage) {
            this.setRandomMotivationMessage(true);
        }

        const message = this.lastMotivationMessage || messageEl.textContent;

        if (this.dashboardComponent) {
            this.dashboardComponent.renderMotivation({
                perfectStreak,
                perfectDay,
                level,
                message
            });
            return;
        }

        streakEl.textContent = `${perfectStreak} day${perfectStreak === 1 ? '' : 's'}`;
        levelEl.textContent = `Lv.${level}`;
        badgeEl.textContent = perfectDay ? '🏅 Earned today' : 'Not yet';
        badgeEl.classList.toggle('badge-perfect', perfectDay);
        badgeEl.classList.toggle('badge-muted', !perfectDay);
        messageEl.textContent = message;
    }

    setRandomMotivationMessage(force = false) {
        const messageEl = document.getElementById('motivationMessage');
        if (!messageEl || this.motivationalMessages.length === 0) return;

        let next = this.lastMotivationMessage;
        if (force || this.motivationalMessages.length === 1) {
            next = this.motivationalMessages[Math.floor(Math.random() * this.motivationalMessages.length)];
        } else {
            let attempts = 0;
            while (next === this.lastMotivationMessage && attempts < 4) {
                next = this.motivationalMessages[Math.floor(Math.random() * this.motivationalMessages.length)];
                attempts += 1;
            }
        }

        this.lastMotivationMessage = next;
        messageEl.textContent = next;
    }

    triggerCelebration() {
        const layer = document.createElement('div');
        layer.className = 'celebration-burst';

        const centerX = window.innerWidth * 0.5;
        const centerY = Math.max(120, window.innerHeight * 0.35);
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b'];

        for (let i = 0; i < 16; i++) {
            const dot = document.createElement('span');
            dot.className = 'celebration-dot';
            dot.style.left = `${centerX}px`;
            dot.style.top = `${centerY}px`;
            dot.style.backgroundColor = colors[i % colors.length];
            dot.style.setProperty('--dx', `${(Math.random() - 0.5) * 180}px`);
            dot.style.setProperty('--dy', `${(Math.random() - 0.7) * 160}px`);
            layer.appendChild(dot);
        }

        document.body.appendChild(layer);
        setTimeout(() => layer.remove(), 700);
    }

    calculateOverallStreak() {
        if (this.habits.length === 0) return 0;

        let streak = 0;
        let cursor = new Date();

        while (true) {
            const dateStr = this.getDateString(cursor);
            const allCompleted = this.habits.every(habit => habit.completedDates.includes(dateStr));
            const isFrozen = this.frozenDates.includes(dateStr);
            if (!allCompleted && !isFrozen) break;
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        return streak;
    }

    updateExpBar() {
        const expFill = document.getElementById('expFill');
        const expValue = document.getElementById('expValue');
        const freezeCount = document.getElementById('freezeCount');
        if (!expFill || !expValue || !freezeCount) return;

        const totalCompletions = this.habits.reduce((sum, h) => sum + h.completedDates.length, 0);
        const consistencyBonus = this.calculatePerfectDayStreak() * 5;
        this.currentExp = (totalCompletions * 10) + consistencyBonus;
        const levelExp = this.currentExp % this.expLevelSize;
        const level = Math.floor(this.currentExp / this.expLevelSize) + 1;
        const percent = Math.min(100, (levelExp / this.expLevelSize) * 100);

        expFill.style.setProperty('--target-width', `${percent}%`);
        expFill.style.width = `${percent}%`;
        expValue.textContent = `Lv.${level} • ${levelExp} / ${this.expLevelSize}`;
        this.grantLevelRewards(level);
        freezeCount.textContent = `🧊 Freeze: ${this.freezeCharges}/${this.maxFreezeCharges}`;
    }

    grantLevelRewards(level) {
        if (level <= this.lastAwardedLevel) return;

        const levelsGained = level - this.lastAwardedLevel;
        const nextCharges = Math.min(this.maxFreezeCharges, this.freezeCharges + levelsGained);
        const gained = nextCharges - this.freezeCharges;

        this.freezeCharges = nextCharges;
        this.lastAwardedLevel = level;

        if (gained > 0) {
            this.showToast(`🎉 Level up! +${gained} Freeze charge`, 'success');
        }
    }

    useFreezeForToday() {
        const today = this.getDateString(new Date());
        if (this.freezeCharges <= 0) {
            this.showToast('No Freeze charges available yet.', 'info');
            return;
        }

        if (this.frozenDates.includes(today)) {
            this.showToast('Freeze is already active for today.', 'info');
            return;
        }

        this.freezeCharges -= 1;
        this.frozenDates.push(today);

        this.habits.forEach((habit) => {
            habit.streak = this.calculateStreak(habit);
        });

        this.saveHabits();
        this.updateStats();
        this.renderHabits();
        this.renderDailyView();
        this.renderDailyChallenges();
        this.showToast('🧊 Freeze activated. Today will not break your streak.', 'success');
    }

    calculateWeeklyAverage() {
        if (this.habits.length === 0) return 0;
        
        const today = new Date();
        let totalCompletions = 0;

        this.habits.forEach(habit => {
            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = this.getDateString(date);
                
                if (habit.completedDates.includes(dateStr)) {
                    totalCompletions++;
                }
            }
        });

        return (totalCompletions / (this.habits.length * 7)) * 100;
    }

    updateInsights() {
        const mostConsistent = this.habits.reduce((max, h) => 
            h.streak > (max?.streak || 0) ? h : max, null);
        document.getElementById('mostConsistent').textContent = 
            mostConsistent ? mostConsistent.name : '-';

        const totalCompletions = this.habits.reduce((sum, h) => 
            sum + h.completedDates.length, 0);
        document.getElementById('totalCompletions').textContent = totalCompletions;

        const bestDay = this.findBestDay();
        document.getElementById('bestDay').textContent = bestDay;

        const successRate = this.calculateSuccessRate();
        document.getElementById('successRate').textContent = Math.round(successRate) + '%';
    }

    findBestDay() {
        const dayCounts = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        this.habits.forEach(habit => {
            habit.completedDates.forEach(dateStr => {
                const date = new Date(dateStr);
                const dayName = days[date.getDay()];
                dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
            });
        });

        let bestDay = '-';
        let maxCount = 0;
        for (const [day, count] of Object.entries(dayCounts)) {
            if (count > maxCount) {
                maxCount = count;
                bestDay = day;
            }
        }

        return bestDay;
    }

    calculateSuccessRate() {
        if (this.habits.length === 0) return 0;

        const today = new Date();
        let totalPossible = 0;
        let totalCompleted = 0;

        this.habits.forEach(habit => {
            const createdDate = new Date(habit.createdDate);
            const daysSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24)) + 1;
            
            totalPossible += daysSinceCreation;
            totalCompleted += habit.completedDates.length;
        });

        return (totalCompleted / totalPossible) * 100;
    }

    manualSave() {
        this.saveHabits();
        this.showToast('✅ All changes saved successfully!', 'success');
    }

    exportData() {
        const dataToExport = {
            version: '3.0',
            exportDate: new Date().toISOString(),
            habits: this.habits,
            freezeCharges: this.freezeCharges,
            lastAwardedLevel: this.lastAwardedLevel,
            frozenDates: this.frozenDates
        };

        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('✅ Data exported successfully!', 'success');
    }

    createSafetyBackup(reason = 'manual') {
        const snapshot = {
            version: '3.0',
            backupDate: new Date().toISOString(),
            reason,
            habits: this.habits,
            freezeCharges: this.freezeCharges,
            lastAwardedLevel: this.lastAwardedLevel,
            frozenDates: this.frozenDates
        };
        localStorage.setItem(this.safetyBackupKey, JSON.stringify(snapshot));
        return snapshot;
    }

    restoreSafetyBackup() {
        const rawBackup = localStorage.getItem(this.safetyBackupKey);
        if (!rawBackup) {
            this.showToast('No safety backup found yet. Import or reset to create one.', 'info');
            return;
        }

        if (!confirm('Restore from the latest safety backup? This replaces current data.')) {
            return;
        }

        try {
            const backup = JSON.parse(rawBackup);
            this.habits = Array.isArray(backup.habits)
                ? backup.habits.map((habit) => this.normalizeHabitData(habit))
                : [];
            this.freezeCharges = parseInt(backup.freezeCharges ?? this.freezeCharges, 10) || 0;
            this.lastAwardedLevel = parseInt(backup.lastAwardedLevel ?? this.lastAwardedLevel, 10) || 1;
            this.frozenDates = Array.isArray(backup.frozenDates) ? backup.frozenDates : [];
            this.saveHabits();
            this.refreshAllViews();
            this.showToast('🛟 Safety backup restored successfully!', 'success');
        } catch (error) {
            this.showToast('❌ Failed to restore backup: ' + error.message, 'error');
        }
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.habits || !Array.isArray(importedData.habits)) {
                    throw new Error('Invalid file format');
                }

                if (confirm('This will replace your current habits. Continue?')) {
                    this.createSafetyBackup('before-import');
                    this.habits = importedData.habits.map((habit) => this.normalizeHabitData(habit));
                    this.freezeCharges = parseInt(importedData.freezeCharges ?? this.freezeCharges, 10) || 0;
                    this.lastAwardedLevel = parseInt(importedData.lastAwardedLevel ?? this.lastAwardedLevel, 10) || 1;
                    this.frozenDates = Array.isArray(importedData.frozenDates) ? importedData.frozenDates : [];
                    this.saveHabits();
                    this.refreshAllViews();
                    this.showToast('✅ Data imported successfully! Safety backup created.', 'success');
                }
            } catch (error) {
                this.showToast('❌ Error importing file: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    resetAllData() {
        if (confirm('⚠️ This will delete ALL your habits. Are you absolutely sure?')) {
            if (confirm('Last confirmation: This cannot be undone!')) {
                this.createSafetyBackup('before-reset');
                this.habits = [];
                this.freezeCharges = 0;
                this.lastAwardedLevel = 1;
                this.frozenDates = [];
                this.saveHabits();
                this.refreshAllViews();
                this.showToast('🗑️ All data has been reset! You can restore from safety backup.', 'success');
            }
        }
    }

    refreshAllViews() {
        this.renderHabits();
        this.renderDailyView();
        this.updateStats();
        this.updateCharts();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.renderDailyChallenges();
    }

    setupAutoSave() {
        setInterval(() => {
            this.saveHabits();
        }, 5 * 60 * 1000);
    }

    saveHabits() {
        localStorage.setItem('habits', JSON.stringify(this.habits));
        localStorage.setItem('freezeCharges', String(this.freezeCharges));
        localStorage.setItem('lastAwardedLevel', String(this.lastAwardedLevel));
        localStorage.setItem('frozenDates', JSON.stringify(this.frozenDates));
        localStorage.setItem('lastSaveTime', new Date().toISOString());

        this.markPendingSync();
        if (navigator.onLine) {
            this.syncPendingChanges({ silent: true });
        }
    }

    loadHabits() {
        const stored = localStorage.getItem('habits');
        this.freezeCharges = parseInt(localStorage.getItem('freezeCharges') || '0', 10);
        this.lastAwardedLevel = parseInt(localStorage.getItem('lastAwardedLevel') || '1', 10);
        try {
            this.frozenDates = JSON.parse(localStorage.getItem('frozenDates') || '[]');
        } catch (error) {
            this.frozenDates = [];
        }

        if (!stored) return [];
        try {
            const parsedHabits = JSON.parse(stored);
            return Array.isArray(parsedHabits) ? parsedHabits.map((habit) => this.normalizeHabitData(habit)) : [];
        } catch (error) {
            this.showToast('Saved data was corrupted. Starting with a clean habit list.', 'error');
            return [];
        }
    }

    loadLastSaveTime() {
        return localStorage.getItem('lastSaveTime') || null;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderDailyChallenges() {
        const list = document.getElementById('dailyChallenges');
        if (!list) return;

        const now = new Date();
        const hour = now.getHours();
        const today = this.getDateString(now);
        const completedToday = this.habits.filter(h => h.completedDates.includes(today)).length;
        const pending = Math.max(0, this.habits.length - completedToday);
        const healthHabits = this.habits.filter(h => h.category === 'health').length;

        const challenges = [];
        challenges.push(hour < 12
            ? 'Morning mission: complete your hardest habit before 11:00.'
            : 'Evening mission: finish one easy habit to protect momentum.');
        challenges.push(`Progress mission: finish ${Math.max(1, pending)} more habit${pending === 1 ? '' : 's'} today.`);
        challenges.push(healthHabits === 0
            ? 'Health mission: add one 10-minute health habit (water, walk, stretch).'
            : 'Health mission: complete at least one health habit today.');
        challenges.push(this.freezeCharges > 0
            ? `Strategy mission: keep your ${this.freezeCharges} Freeze charge${this.freezeCharges > 1 ? 's' : ''} for true emergencies.`
            : 'Level-up mission: maintain your streak to earn a Freeze charge.');

        list.innerHTML = challenges.map(item => `<li>${this.escapeHtml(item)}</li>`).join('');
    }

    initializeOnboarding() {
        const modal = document.getElementById('onboardingModal');
        if (!modal) return;

        const completed = localStorage.getItem(this.onboardingCompletedKey) === 'true';
        const savedPreferences = localStorage.getItem(this.onboardingStorageKey);

        if (savedPreferences) {
            try {
                this.onboardingData = {
                    ...this.onboardingData,
                    ...JSON.parse(savedPreferences)
                };
            } catch (error) {
                // Keep defaults if parsing fails
            }
        }

        this.syncOnboardingInputsFromData();
        this.syncOnboardingDataFromInputs();

        if (completed || this.habits.length > 0) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            return;
        }

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        this.updateOnboardingUI();
    }

    syncOnboardingInputsFromData() {
        document.querySelectorAll('#onboardingStep1 input[type="checkbox"]').forEach((input) => {
            input.checked = this.onboardingData.goals.includes(input.value);
        });

        document.querySelectorAll('input[name="onboardingTime"]').forEach((input) => {
            input.checked = input.value === this.onboardingData.preferredTime;
        });

        document.querySelectorAll('input[name="onboardingDifficulty"]').forEach((input) => {
            input.checked = input.value === this.onboardingData.difficulty;
        });
    }

    syncOnboardingDataFromInputs() {
        const goals = Array.from(document.querySelectorAll('#onboardingStep1 input[type="checkbox"]:checked')).map((input) => input.value);
        const preferredTime = document.querySelector('input[name="onboardingTime"]:checked')?.value || 'morning';
        const difficulty = document.querySelector('input[name="onboardingDifficulty"]:checked')?.value || 'easy';
        this.onboardingData = { goals, preferredTime, difficulty };
    }

    handleOnboardingNext() {
        this.syncOnboardingDataFromInputs();
        const goals = this.onboardingData.goals;

        if (this.onboardingStep === 1 && goals.length === 0) {
            this.showToast('Please select at least one goal.', 'info');
            return;
        }

        if (this.onboardingStep < 3) {
            this.onboardingStep += 1;
            this.updateOnboardingUI();
            return;
        }

        this.finishOnboarding(false);
    }

    handleOnboardingBack() {
        if (this.onboardingStep <= 1) return;
        this.onboardingStep -= 1;
        this.updateOnboardingUI();
    }

    updateOnboardingUI() {
        document.querySelectorAll('.onboarding-step').forEach((step, index) => {
            step.classList.toggle('hidden', (index + 1) !== this.onboardingStep);
        });

        const progressFill = document.getElementById('onboardingProgressFill');
        const progressText = document.getElementById('onboardingProgressText');
        const backBtn = document.getElementById('onboardingBackBtn');
        const nextBtn = document.getElementById('onboardingNextBtn');
        if (progressFill) progressFill.style.width = `${(this.onboardingStep / 3) * 100}%`;
        if (progressText) progressText.textContent = `Step ${this.onboardingStep} of 3`;
        backBtn?.classList.toggle('hidden', this.onboardingStep === 1);
        if (nextBtn) nextBtn.textContent = this.onboardingStep === 3 ? 'Finish & create habits' : 'Next';
        this.renderStarterPreview();
    }

    renderStarterPreview() {
        const preview = document.getElementById('starterHabitsPreview');
        if (!preview) return;

        const goals = Array.from(document.querySelectorAll('#onboardingStep1 input[type="checkbox"]:checked')).map((input) => input.value);
        const preferredTime = document.querySelector('input[name="onboardingTime"]:checked')?.value || this.onboardingData.preferredTime;
        const difficulty = document.querySelector('input[name="onboardingDifficulty"]:checked')?.value || this.onboardingData.difficulty;
        const habits = this.generateStarterHabits({ goals, preferredTime, difficulty });
        preview.innerHTML = habits.map((habit) => `<li>${this.escapeHtml(habit.name)}</li>`).join('');
    }

    generateStarterHabits(preferences) {
        const planSize = preferences.difficulty === 'hard' ? 5 : preferences.difficulty === 'medium' ? 4 : 3;
        const templates = {
            fitness: {
                easy: [{ name: '10-minute walk', category: 'health' }, { name: 'Morning stretch (5 min)', category: 'health' }],
                medium: [{ name: '30-minute workout', category: 'health' }, { name: 'Bodyweight routine (15 min)', category: 'health' }],
                hard: [{ name: '60-minute training session', category: 'health' }, { name: 'Track calories and hydration', category: 'health' }]
            },
            study: {
                easy: [{ name: 'Read 10 pages', category: 'learning' }, { name: 'Review notes for 15 minutes', category: 'learning' }],
                medium: [{ name: 'Focused study block (45 min)', category: 'learning' }, { name: 'Practice problems for 30 minutes', category: 'learning' }],
                hard: [{ name: 'Deep study sprint (90 min)', category: 'learning' }, { name: 'Summarize one chapter', category: 'learning' }]
            },
            productivity: {
                easy: [{ name: 'Plan top 3 tasks', category: 'productivity' }, { name: '2-minute inbox cleanup', category: 'productivity' }],
                medium: [{ name: 'Pomodoro focus session (50 min)', category: 'productivity' }, { name: 'Daily review and prioritization', category: 'productivity' }],
                hard: [{ name: 'Two deep-work sessions', category: 'productivity' }, { name: 'Zero-inbox challenge', category: 'productivity' }]
            },
            wellness: {
                easy: [{ name: 'Drink 8 glasses of water', category: 'wellness' }, { name: '5-minute breathing session', category: 'wellness' }],
                medium: [{ name: '20-minute meditation', category: 'wellness' }, { name: 'Digital sunset 1 hour before bed', category: 'wellness' }],
                hard: [{ name: '30-minute mindfulness practice', category: 'wellness' }, { name: 'Evening journal + gratitude list', category: 'wellness' }]
            }
        };

        const fallback = [
            { name: 'Review your day in 5 minutes', category: 'productivity' },
            { name: 'Drink water after waking up', category: 'wellness' },
            { name: 'Move your body for 10 minutes', category: 'health' }
        ];

        const selectedGoals = preferences.goals.length > 0 ? preferences.goals : ['productivity'];
        const generated = [];

        selectedGoals.forEach((goal) => {
            const group = templates[goal]?.[preferences.difficulty] || [];
            group.forEach((habit) => {
                generated.push({
                    ...habit,
                    name: this.attachPreferredTime(habit.name, preferences.preferredTime)
                });
            });
        });

        fallback.forEach((habit) => generated.push({
            ...habit,
            name: this.attachPreferredTime(habit.name, preferences.preferredTime)
        }));

        const deduped = [];
        const used = new Set();
        generated.forEach((habit) => {
            const key = habit.name.toLowerCase();
            if (!used.has(key) && deduped.length < planSize) {
                used.add(key);
                deduped.push(habit);
            }
        });

        return deduped;
    }

    attachPreferredTime(habitName, preferredTime) {
        const label = preferredTime.charAt(0).toUpperCase() + preferredTime.slice(1);
        return `${habitName} (${label})`;
    }

    finishOnboarding(skipped = false) {
        const modal = document.getElementById('onboardingModal');
        if (!modal) return;

        localStorage.setItem(this.onboardingStorageKey, JSON.stringify(this.onboardingData));
        localStorage.setItem(this.onboardingCompletedKey, 'true');

        if (!skipped) {
            const starterHabits = this.generateStarterHabits(this.onboardingData);
            const reminderTimeMap = { morning: '08:00', afternoon: '13:00', evening: '20:00' };
            const preferredReminderTime = reminderTimeMap[this.onboardingData.preferredTime] || '20:00';

            starterHabits.forEach((starterHabit) => {
                const alreadyExists = this.habits.some((habit) => habit.name.toLowerCase() === starterHabit.name.toLowerCase());
                if (alreadyExists) return;

                this.habits.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    name: starterHabit.name,
                    category: starterHabit.category,
                    type: 'build',
                    createdDate: new Date().toISOString(),
                    completedDates: [],
                    skippedDates: [],
                    completionTimestamps: [],
                    reminder: {
                        ...this.getDefaultReminderSettings(),
                        time: preferredReminderTime
                    },
                    streak: 0
                });
            });

            this.saveHabits();
            this.renderHabits();
            this.renderDailyView();
            this.updateStats();
            this.updateCharts();
            this.renderWeeklyTracker();
            this.renderMonthlyTracker();
            this.renderDailyChallenges();
            this.showToast('Starter habits created from your onboarding preferences!', 'success');
        } else {
            this.showToast('Onboarding skipped. You can still add habits manually anytime.', 'info');
        }

        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

// Initialize the app
const app = new HabitTracker();
window.app = app;

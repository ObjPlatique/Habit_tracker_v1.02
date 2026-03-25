// Habit Tracker Application with Routine View Menu and Day Details
// Initialize Language Manager
const langManager = new LanguageManager();

// Automatic timezone detection from browser locale/location
function detectUserTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    localStorage.setItem('timezone', tz);
    return tz;
}

// Setup event listeners for settings
document.addEventListener('DOMContentLoaded', () => {
    detectUserTimezone();

    document.getElementById('sidebarLanguageSelect').value = langManager.currentLanguage;
    langManager.updatePageLanguage();

    document.getElementById('sidebarLanguageSelect').addEventListener('change', (e) => {
        langManager.setLanguage(e.target.value);
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', savedTheme === 'dark');
    document.getElementById('themeToggle').checked = savedTheme === 'dark';

    document.getElementById('themeToggle').addEventListener('change', (event) => {
        const isDark = event.target.checked;
        document.body.classList.toggle('dark-theme', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
        document.body.classList.toggle('sidebar-collapsed', savedSidebarState === 'true');
    } else if (window.innerWidth <= 992) {
        document.body.classList.add('sidebar-collapsed');
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
        this.habits = this.loadHabits();
        this.motivationalMessages = [
            'You are one small action away from progress 🌱',
            'Tiny wins build unstoppable momentum 💪',
            'Future you will thank you for this habit ✨',
            'Keep the streak warm—you have got this 🔥',
            'A gentle reminder: consistency beats intensity 🌟'
        ];
        this.lineChart = null;
        this.pieChart = null;
        this.weeklyTrendChart = null;
        this.monthlyAnalyticsChart = null;
        this.calendarHeatmap = null;
        this.progressRings = null;
        this.streakVisualizer = null;
        this.currentExp = 0;
        this.expLevelSize = 100;
        this.currentChartRange = 7;
        this.currentMonth = new Date();
        this.currentView = 'daily';
        this.selectedDate = this.getDateString(new Date());
        this.lastSaveTime = this.loadLastSaveTime();
        this.initializeEventListeners();
        this.renderHabits();
        this.updateStats();
        this.initializeCharts();
        this.initializeAnalyticsCharts();
        this.renderTopHabitsSidebar();
        this.updateExpBar();
        this.renderDailyView();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.updateAnalyticsDashboard();
        this.setupAutoSave();
        this.renderDailyChallenges();
        this.initializeReminderSystem();
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
        normalized.completedDates = Array.isArray(normalized.completedDates) ? normalized.completedDates : [];
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

        // Header buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.manualSave());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAllData());
        document.getElementById('sidebarResetBtn').addEventListener('click', () => this.resetAllData());
        document.getElementById('fileInput').addEventListener('change', (e) => this.importData(e));
        document.getElementById('sidebarToggleBtn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('useFreezeBtn').addEventListener('click', () => this.useFreezeForToday());
        document.getElementById('refreshChallengesBtn').addEventListener('click', () => this.renderDailyChallenges());

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
        document.getElementById('searchInput').addEventListener('input', () => this.filterHabits());
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
        const closeBtn = document.querySelector('.close');

        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('show');
        });

        closeBtn.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });

        // Day details modal
        const dayDetailsClose = document.querySelectorAll('.close')[0];
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

        window.addEventListener('beforeunload', () => this.saveHabits());
        window.addEventListener('resize', () => this.updateAnalyticsDashboard());
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

        this.showToast(`Switched to ${view.charAt(0).toUpperCase() + view.slice(1)} view`, 'info');
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

    renderTopHabitsSidebar() {
        const topHabitsList = document.getElementById('topHabitsList');
        if (!topHabitsList) return;

        if (this.habits.length === 0) {
            topHabitsList.innerHTML = `<p class="empty-message">${langManager.get('noHabits')}</p>`;
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
        const today = new Date();
        document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        if (this.habits.length === 0) {
            dailyGrid.innerHTML = '<p class="empty-message">No habits yet. Add one to get started!</p>';
            return;
        }

        dailyGrid.innerHTML = this.habits.map(habit => {
            const isCompleted = this.isCompletedToday(habit);
            return `
                <div class="daily-habit-item ${isCompleted ? 'completed' : 'missed'}">
                    <div>
                        <div class="daily-habit-name">${this.escapeHtml(habit.name)}</div>
                        <div class="daily-habit-category ${habit.category}">${habit.category}</div>
                    </div>
                    <button class="daily-check-btn ${isCompleted ? 'completed' : ''}" 
                            onclick="app.toggleHabitCompletion(${habit.id})">
                        ${isCompleted ? '✓ Done' : 'Mark Done'}
                    </button>
                </div>
            `;
        }).join('');
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
            return `
                <div class="day-habit-detail ${isCompleted ? 'completed' : ''}">
                    <div class="day-habit-detail-name">
                        <div class="day-habit-detail-title">${this.escapeHtml(habit.name)}</div>
                        <span class="day-habit-detail-cat ${habit.category}">${habit.category}</span>
                    </div>
                    <span class="day-habit-status ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? '✓ Done' : 'Pending'}
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
        this.initializeLineChart();
        this.initializePieChart();
    }

    initializeLineChart() {
        const ctx = document.getElementById('progressChart').getContext('2d');
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
        const ctx = document.getElementById('completionChart').getContext('2d');
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
        const habitName = input.value.trim();

        if (!habitName) {
            this.showToast('Please enter a habit name', 'error');
            return;
        }

        const newHabit = {
            id: Date.now(),
            name: habitName,
            category: category,
            createdDate: new Date().toISOString(),
            completedDates: [],
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
        this.showToast(`✅ Habit "${habitName}" added successfully!`, 'success');
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
            habit.completionTimestamps = habit.completionTimestamps.filter((isoTs) => !isoTs.startsWith(today));
            this.showToast(`${habit.name} marked incomplete`, 'info');
        } else {
            habit.completedDates.push(today);
            habit.completionTimestamps.push(new Date().toISOString());
            this.showToast(`✅ Great! ${habit.name} completed!`, 'success');
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
            const habitName = item.querySelector('.habit-name').textContent.toLowerCase();
            const categoryBadge = item.querySelector('.category-badge').textContent;

            const matchesSearch = habitName.includes(searchTerm);
            const matchesCategory = categoryFilter === 'all' || categoryBadge.toLowerCase() === categoryFilter;

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
            habitsList.innerHTML = '<p class="empty-message">No habits yet. Add one to get started!</p>';
            return;
        }

        habitsList.innerHTML = this.habits.map(habit => {
            const isCompleted = this.isCompletedToday(habit);
            const stateClass = isCompleted ? 'completed' : 'missed';
            const progress = this.getProgressPercentage(habit);
            const suggestion = this.getBestReminderTime(habit);
            const reminderStatus = habit.reminder.enabled ? `On at ${habit.reminder.time}` : 'Off';
            const reminderHistory = habit.reminder.history.slice(-5).reverse();
            
            return `
                <div class="habit-item ${stateClass}" data-habit-id="${habit.id}">
                    <div class="habit-info">
                        <div class="habit-name">${this.escapeHtml(habit.name)}</div>
                        <div class="habit-meta">
                            <span class="category-badge ${habit.category}">${habit.category}</span>
                            <span>Completed: ${habit.completedDates.length} days</span>
                            <span class="reminder-pill">🔔 ${this.escapeHtml(reminderStatus)}</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="habit-streak">
                        <div class="streak-number">🔥 ${habit.streak}</div>
                        <div class="streak-label">Streak</div>
                    </div>
                    <div class="habit-actions">
                        <button class="btn btn-check" onclick="app.toggleHabitCompletion(${habit.id})">
                            ${isCompleted ? '✓ Done' : 'Mark Done'}
                        </button>
                        <button class="btn btn-edit" onclick="app.toggleReminderEdit(${habit.id})">Edit</button>
                        <button class="btn btn-delete" onclick="app.deleteHabit(${habit.id})">Delete</button>
                    </div>
                </div>
                <div class="habit-reminder-editor hidden" id="reminderEditor-${habit.id}">
                    <h4>Reminder Settings</h4>
                    <div class="reminder-form-row">
                        <label>
                            <input type="checkbox" id="reminderEnabled-${habit.id}" ${habit.reminder.enabled ? 'checked' : ''}>
                            Enable notifications
                        </label>
                    </div>
                    <div class="reminder-form-row">
                        <label for="reminderTime-${habit.id}">Reminder time</label>
                        <input type="time" id="reminderTime-${habit.id}" value="${this.escapeHtml(habit.reminder.time)}">
                        <button class="btn btn-suggest" onclick="app.applySuggestedReminder(${habit.id})">Use smart suggestion (${this.escapeHtml(suggestion)})</button>
                    </div>
                    <div class="reminder-form-row">
                        <button class="btn btn-check" onclick="app.saveReminderSettings(${habit.id})">Save reminder</button>
                        <button class="btn btn-permission" onclick="app.requestNotificationPermission()">Enable browser permission</button>
                    </div>
                    <div class="reminder-history">
                        <strong>Reminder history</strong>
                        ${reminderHistory.length === 0 ? '<p class="empty-message">No reminder events yet.</p>' : `
                            <ul>
                                ${reminderHistory.map(entry => `<li>${this.escapeHtml(new Date(entry.triggeredAt).toLocaleString())} — ${this.escapeHtml(entry.message)}</li>`).join('')}
                            </ul>
                        `}
                    </div>
                </div>
            `;
        }).join('');
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
        const body = `Time for "${habit.name}". ${message}`;

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

        document.getElementById('totalHabits').textContent = totalHabits;
        document.getElementById('completedToday').textContent = completedToday;
        document.getElementById('currentStreak').textContent = overallStreak;

        const weeklyAverage = this.calculateWeeklyAverage();
        document.getElementById('weeklyAverage').textContent = Math.round(weeklyAverage) + '%';

        this.updateInsights();
        this.updateExpBar();
        this.renderTopHabitsSidebar();
        this.updateAnalyticsDashboard();
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
        this.currentExp = totalCompletions * 10;
        const levelExp = this.currentExp % this.expLevelSize;
        const level = Math.floor(this.currentExp / this.expLevelSize) + 1;
        const percent = Math.min(100, (levelExp / this.expLevelSize) * 100);

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
            habits: this.habits
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
                    this.habits = importedData.habits;
                    this.saveHabits();
                    this.renderHabits();
                    this.renderDailyView();
                    this.updateStats();
                    this.updateCharts();
                    this.renderWeeklyTracker();
                    this.renderMonthlyTracker();
                    this.showToast('✅ Data imported successfully!', 'success');
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
                this.habits = [];
                this.saveHabits();
                this.renderHabits();
                this.renderDailyView();
                this.updateStats();
                this.updateCharts();
                this.renderWeeklyTracker();
                this.renderMonthlyTracker();
                this.renderDailyChallenges();
                this.showToast('🗑️ All data has been reset!', 'success');
            }
        }
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
    }

    loadHabits() {
        const stored = localStorage.getItem('habits');
        this.freezeCharges = parseInt(localStorage.getItem('freezeCharges') || '0', 10);
        this.lastAwardedLevel = parseInt(localStorage.getItem('lastAwardedLevel') || '1', 10);
        this.frozenDates = JSON.parse(localStorage.getItem('frozenDates') || '[]');
        return stored ? JSON.parse(stored) : [];
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
}

// Initialize the app
const app = new HabitTracker();

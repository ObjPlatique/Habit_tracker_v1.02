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
class HabitTracker {
    
    constructor() {
        this.freezeCharges = 0;
        this.maxFreezeCharges = 2;
        this.lastAwardedLevel = 1;
        this.frozenDates = [];
        this.habits = this.loadHabits();
        this.lineChart = null;
        this.pieChart = null;
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
        this.renderTopHabitsSidebar();
        this.updateExpBar();
        this.renderDailyView();
        this.renderWeeklyTracker();
        this.renderMonthlyTracker();
        this.setupAutoSave();
        this.renderCopilotSuggestions();
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
        document.getElementById('refreshCopilotBtn').addEventListener('click', () => this.renderCopilotSuggestions());

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
                <div class="daily-habit-item ${isCompleted ? 'completed' : ''}">
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
        this.renderCopilotSuggestions();

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
            this.renderCopilotSuggestions();
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
            this.showToast(`${habit.name} marked incomplete`, 'info');
        } else {
            habit.completedDates.push(today);
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
        this.renderCopilotSuggestions();
    }

    completeAllToday() {
        const today = this.getDateString(new Date());
        let count = 0;

        this.habits.forEach(habit => {
            if (!habit.completedDates.includes(today)) {
                habit.completedDates.push(today);
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
            this.renderCopilotSuggestions();
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
            this.renderCopilotSuggestions();
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
            const progress = this.getProgressPercentage(habit);
            
            return `
                <div class="habit-item ${isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}">
                    <div class="habit-info">
                        <div class="habit-name">${this.escapeHtml(habit.name)}</div>
                        <div class="habit-meta">
                            <span class="category-badge ${habit.category}">${habit.category}</span>
                            <span>Completed: ${habit.completedDates.length} days</span>
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
                        <button class="btn btn-delete" onclick="app.deleteHabit(${habit.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
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
        this.renderCopilotSuggestions();
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
                this.renderCopilotSuggestions();
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

    renderCopilotSuggestions() {
        const list = document.getElementById('copilotSuggestions');
        if (!list) return;

        const now = new Date();
        const hour = now.getHours();
        const today = this.getDateString(now);
        const completedToday = this.habits.filter(h => h.completedDates.includes(today)).length;
        const pending = Math.max(0, this.habits.length - completedToday);
        const healthHabits = this.habits.filter(h => h.category === 'health').length;

        const suggestions = [];
        suggestions.push(hour < 12 ? 'Buổi sáng: hoàn thành 1 thói quen khó nhất trước 11h.' : 'Buổi chiều/tối: chọn 1 thói quen nhẹ để giữ đà.');
        suggestions.push(`Hôm nay bạn đã hoàn thành ${completedToday}/${this.habits.length} thói quen. Ưu tiên ${pending} thói quen còn lại.`);
        suggestions.push(healthHabits === 0 ? 'Nên thêm 1 thói quen sức khỏe ngắn: uống nước hoặc đi bộ 10 phút.' : 'Duy trì thói quen sức khỏe để tăng năng lượng lâu dài.');
        suggestions.push(this.freezeCharges > 0 ? `Bạn có ${this.freezeCharges} Freeze charge. Chỉ dùng khi thật sự bận.` : 'Lên level để nhận Freeze charge bảo vệ chuỗi.');

        list.innerHTML = suggestions.map(item => `<li>${this.escapeHtml(item)}</li>`).join('');
    }
}

// Initialize the app
const app = new HabitTracker();

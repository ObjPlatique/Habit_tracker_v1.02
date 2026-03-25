/**
 * Chatbot Logic module
 * Connects UI events, habit summary generation, conversation history,
 * and API interactions.
 */
(function () {
  class HabitChatbotEngine {
    constructor() {
      this.ui = new window.ChatbotUI();
      this.historyKey = 'habit_chat_history';
      this.maxHistoryItems = 20;

      if (!this.ui.form) return;

      this.loadHistory();

      this.registerEvents();
      this.bindLanguageUpdates();
      this.updateLocalizedText();
      this.renderWelcomeMessageIfNeeded();
    }

    registerEvents() {
      this.ui.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = this.ui.input.value.trim();
        if (!message) return;

        await this.handleUserMessage(message);
      });

      this.ui.suggestButton?.addEventListener('click', () => {
        const isVietnamese = this.getCurrentLanguage() === 'vie';
        const quickMessage = isVietnamese ? 'Gợi ý thói quen mới cho mình.' : 'Suggest habits for me.';
        this.handleUserMessage(quickMessage);
      });

      this.ui.analyzeButton?.addEventListener('click', () => {
        const isVietnamese = this.getCurrentLanguage() === 'vie';
        const quickMessage = isVietnamese
          ? 'Phân tích tiến độ của mình và tạo báo cáo tuần.'
          : 'Analyze my progress and create a weekly report.';
        this.handleUserMessage(quickMessage);
      });
    }

    async handleUserMessage(message) {
      this.addAndRenderMessage('user', message);
      this.ui.input.value = '';

      this.ui.setTyping(true);
      this.ui.setInputDisabled(true);

      const habitsData = this.getHabitSummary();
      const language = this.getCurrentLanguage();
      const reply = await window.sendMessageToAI(message, habitsData, language);

      this.ui.setTyping(false);
      this.ui.setInputDisabled(false);
      this.addAndRenderMessage('bot', reply);
    }


    bindLanguageUpdates() {
      const languageSelect = document.getElementById('sidebarLanguageSelect');
      if (languageSelect) {
        languageSelect.addEventListener('change', () => this.updateLocalizedText());
      }
      window.addEventListener('storage', (event) => {
        if (event.key === 'language') this.updateLocalizedText();
      });
    }

    updateLocalizedText() {
      const isVietnamese = this.getCurrentLanguage() === 'vie';
      const title = document.querySelector('.chatbot-header h3');
      if (title) title.textContent = isVietnamese ? 'Trợ lý thói quen AI' : 'AI Habit Coach';

      if (this.ui.typingIndicator) {
        this.ui.typingIndicator.textContent = isVietnamese ? 'AI đang trả lời...' : 'AI is typing...';
      }

      if (this.ui.input) {
        this.ui.input.placeholder = isVietnamese
          ? 'Hỏi về mục tiêu, thói quen, hoặc động lực...'
          : 'Ask about habits, goals, or motivation...';
      }

      if (this.ui.suggestButton) {
        this.ui.suggestButton.textContent = isVietnamese ? 'Gợi ý thói quen' : 'Suggest habits';
      }

      if (this.ui.analyzeButton) {
        this.ui.analyzeButton.textContent = isVietnamese ? 'Phân tích tiến độ' : 'Analyze my progress';
      }

      const sendBtn = this.ui.form?.querySelector('button[type="submit"]');
      if (sendBtn) sendBtn.textContent = isVietnamese ? 'Gửi' : 'Send';
    }

    getCurrentLanguage() {
      if (window.langManager && window.langManager.currentLanguage) {
        return window.langManager.currentLanguage;
      }
      return localStorage.getItem('language') || 'eng';
    }

    getHabits() {
      if (window.app && Array.isArray(window.app.habits)) {
        return window.app.habits;
      }

      try {
        const localHabits = JSON.parse(localStorage.getItem('habits') || '[]');
        return Array.isArray(localHabits) ? localHabits : [];
      } catch (_) {
        return [];
      }
    }

    getHabitSummary() {
      const habits = this.getHabits();
      const today = new Date();
      const todayKey = this.getDateKey(today);
      const totalHabits = habits.length;
      const completedToday = habits.filter((habit) => this.getHabitCompletedDates(habit).includes(todayKey)).length;
      const todayCompletionRate = totalHabits ? Math.round((completedToday / totalHabits) * 100) : 0;

      const totalStreak = habits.reduce((sum, habit) => sum + (habit.streak || 0), 0);
      const avgStreak = totalHabits ? Number((totalStreak / totalHabits).toFixed(1)) : 0;

      const categoryStats = habits.reduce((acc, habit) => {
        const key = habit.category || 'other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const topHabits = [...habits]
        .sort((a, b) => (b.streak || 0) - (a.streak || 0))
        .slice(0, 3)
        .map((habit) => `${habit.name} (streak: ${habit.streak || 0})`);

      const currentWeekDates = this.getRecentDateKeys(7, 0);
      const previousWeekDates = this.getRecentDateKeys(7, 7);
      const currentWeekRate = this.getPeriodCompletionRate(habits, currentWeekDates);
      const previousWeekRate = this.getPeriodCompletionRate(habits, previousWeekDates);
      const weeklyChange = Number((currentWeekRate - previousWeekRate).toFixed(1));

      const habitList = habits.map((habit) => {
        const completedDates = this.getHabitCompletedDates(habit);
        const createdDate = this.normalizeDate(habit.createdDate);
        const completedCount = completedDates.length;
        const totalDays = createdDate
          ? Math.max(1, Math.ceil((today - new Date(createdDate)) / 86400000) + 1)
          : Math.max(1, currentWeekDates.length);
        const completionRate = Math.round((completedCount / totalDays) * 100);
        const weeklyCompleted = completedDates.filter((date) => currentWeekDates.includes(date)).length;
        const weeklyRate = Math.round((weeklyCompleted / currentWeekDates.length) * 100);

        return {
          id: habit.id,
          name: habit.name,
          category: habit.category || 'other',
          type: habit.type || 'build',
          streak: habit.streak || 0,
          completedCount,
          completionRate,
          weeklyRate,
          lastCompletedDate: completedDates[completedDates.length - 1] || null,
          createdDate: createdDate || null
        };
      });

      const motivationSignals = {
        lowerWeeklyCompletion: currentWeekRate < previousWeekRate,
        lowTodayCompletion: todayCompletionRate < 30,
        lowAverageStreak: avgStreak < 2,
        noCompletionToday: completedToday === 0
      };
      motivationSignals.needsSupport = Object.values(motivationSignals).filter(Boolean).length >= 2;

      const localStorageHabits = this.getRawLocalStorageHabits();

      const rawSummary = [
        `Total habits: ${totalHabits}`,
        `Completed today: ${completedToday}`,
        `Completion today: ${todayCompletionRate}%`,
        `Average streak: ${avgStreak}`,
        `Categories: ${JSON.stringify(categoryStats)}`,
        `Current week completion: ${currentWeekRate}%`,
        `Previous week completion: ${previousWeekRate}%`,
        `Weekly change: ${weeklyChange}%`,
        `Top streak habits: ${topHabits.join(', ') || 'None yet'}`,
        'Habit list:',
        ...(habitList.map((habit) => `- ${habit.name} | streak: ${habit.streak} | completion: ${habit.completionRate}% | weekly: ${habit.weeklyRate}%`))
      ].join('\n');

      return {
        date: todayKey,
        totalHabits,
        completedToday,
        todayCompletionRate,
        avgStreak,
        categoryStats,
        topHabits,
        habitList,
        weeklyReport: {
          currentWeekRate,
          previousWeekRate,
          weeklyChange,
          trend: weeklyChange >= 0 ? 'improving' : 'declining'
        },
        motivationSignals,
        localStorageHabits,
        rawSummary
      };
    }

    getRawLocalStorageHabits() {
      try {
        const raw = localStorage.getItem('habits') || '[]';
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.map((habit) => ({
          id: habit.id,
          name: habit.name,
          category: habit.category,
          type: habit.type,
          streak: habit.streak,
          completedDates: this.getHabitCompletedDates(habit)
        }));
      } catch (_) {
        return [];
      }
    }

    getHabitCompletedDates(habit) {
      return Array.isArray(habit.completedDates)
        ? [...habit.completedDates].filter((date) => this.normalizeDate(date)).sort()
        : [];
    }

    normalizeDate(value) {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    }

    getDateKey(date) {
      return date.toISOString().split('T')[0];
    }

    getRecentDateKeys(length, startOffsetDays) {
      return Array.from({ length }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (startOffsetDays + index));
        return this.getDateKey(date);
      });
    }

    getPeriodCompletionRate(habits, dateKeys) {
      const totalPossible = habits.length * dateKeys.length;
      if (!totalPossible) return 0;

      let completed = 0;
      habits.forEach((habit) => {
        const completedSet = new Set(this.getHabitCompletedDates(habit));
        dateKeys.forEach((dateKey) => {
          if (completedSet.has(dateKey)) completed += 1;
        });
      });

      return Number(((completed / totalPossible) * 100).toFixed(1));
    }

    getHistory() {
      try {
        const history = JSON.parse(localStorage.getItem(this.historyKey) || '[]');
        return Array.isArray(history) ? history : [];
      } catch (_) {
        return [];
      }
    }

    saveHistory(history) {
      localStorage.setItem(this.historyKey, JSON.stringify(history.slice(-this.maxHistoryItems)));
    }

    loadHistory() {
      const history = this.getHistory();
      history.forEach((item) => {
        this.ui.addMessage(item.role, item.text);
      });
    }

    addAndRenderMessage(role, text) {
      this.ui.addMessage(role, text);
      const history = this.getHistory();
      history.push({ role, text, ts: Date.now() });
      this.saveHistory(history);
    }

    renderWelcomeMessageIfNeeded() {
      const history = this.getHistory();
      if (history.length > 0) return;

      const isVietnamese = this.getCurrentLanguage() === 'vie';
      const welcome = isVietnamese
        ? 'Xin chào! Mình là trợ lý thói quen 🤖. Hãy hỏi mình về mục tiêu (sức khỏe, học tập, năng suất), mẹo tạo thói quen, hoặc phân tích tiến độ của bạn.'
        : 'Hi! I\'m your habit coach 🤖. Ask me for goal-based habit ideas (fitness, study, productivity), motivation, or progress feedback based on your current habits.';
      this.addAndRenderMessage('bot', welcome);
    }
  }

  window.HabitChatbotEngine = HabitChatbotEngine;
})();

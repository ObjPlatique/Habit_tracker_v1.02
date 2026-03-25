/**
 * Chatbot Logic module
 * Connects UI events, habit summary generation, conversation history,
 * and API interactions.
 */
(function () {
  class HabitChatbot {
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
      });
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
      const today = new Date().toISOString().split('T')[0];
      const totalHabits = habits.length;
      const completedToday = habits.filter((habit) => Array.isArray(habit.completedDates) && habit.completedDates.includes(today)).length;
      const todayCompletionRate = totalHabits ? Math.round((completedToday / totalHabits) * 100) : 0;

      const totalStreak = habits.reduce((sum, habit) => sum + (habit.streak || 0), 0);
      const avgStreak = totalHabits ? (totalStreak / totalHabits).toFixed(1) : '0.0';

      const categoryStats = habits.reduce((acc, habit) => {
        const key = habit.category || 'other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const topHabits = [...habits]
        .sort((a, b) => (b.streak || 0) - (a.streak || 0))
        .slice(0, 3)
        .map((habit) => `${habit.name} (streak: ${habit.streak || 0})`);

      const rawSummary = [
        `Total habits: ${totalHabits}`,
        `Completed today: ${completedToday}`,
        `Completion today: ${todayCompletionRate}%`,
        `Average streak: ${avgStreak}`,
        `Categories: ${JSON.stringify(categoryStats)}`,
        `Top streak habits: ${topHabits.join(', ') || 'None yet'}`
      ].join('\n');

      return {
        totalHabits,
        completedToday,
        todayCompletionRate,
        avgStreak,
        categoryStats,
        topHabits,
        rawSummary
      };
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

  document.addEventListener('DOMContentLoaded', () => {
    window.habitChatbot = new HabitChatbot();
  });
})();

(function () {
  class DashboardComponent {
    renderStats({ totalHabits, completedToday, overallStreak, weeklyAverage }) {
      const totalEl = document.getElementById('totalHabits');
      const completedEl = document.getElementById('completedToday');
      const streakEl = document.getElementById('currentStreak');
      const weeklyAvgEl = document.getElementById('weeklyAverage');

      if (totalEl) totalEl.textContent = totalHabits;
      if (completedEl) completedEl.textContent = completedToday;
      if (streakEl) streakEl.textContent = overallStreak;
      if (weeklyAvgEl) weeklyAvgEl.textContent = `${Math.round(weeklyAverage)}%`;
    }

    renderMotivation({ perfectStreak, perfectDay, level, message }) {
      const streakEl = document.getElementById('dailyStreakValue');
      const badgeEl = document.getElementById('perfectDayBadge');
      const messageEl = document.getElementById('motivationMessage');
      const levelEl = document.getElementById('levelValue');
      if (!streakEl || !badgeEl || !messageEl || !levelEl) return;

      streakEl.textContent = `${perfectStreak} day${perfectStreak === 1 ? '' : 's'}`;
      levelEl.textContent = `Lv.${level}`;
      badgeEl.textContent = perfectDay ? '🏅 Earned today' : 'Not yet';
      badgeEl.classList.toggle('badge-perfect', perfectDay);
      badgeEl.classList.toggle('badge-muted', !perfectDay);
      messageEl.textContent = message;
    }
  }

  window.DashboardComponent = DashboardComponent;
})();

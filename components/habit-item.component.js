(function () {
  class HabitItemComponent {
    constructor({ escapeHtml, getHabitActionText, getProgressPercentage, getBestReminderTime }) {
      this.escapeHtml = escapeHtml;
      this.getHabitActionText = getHabitActionText;
      this.getProgressPercentage = getProgressPercentage;
      this.getBestReminderTime = getBestReminderTime;
    }

    render(habit, { isCompleted, isImportant, isJustCompleted, typeMeta }) {
      const stateClass = isCompleted ? 'completed' : 'missed';
      const progress = this.getProgressPercentage(habit);
      const suggestion = this.getBestReminderTime(habit);
      const reminderStatus = habit.reminder.enabled ? `On at ${habit.reminder.time}` : 'Off';
      const reminderHistory = habit.reminder.history.slice(-5).reverse();

      return `
        <div class="habit-item ${stateClass} ${typeMeta.className} ${isJustCompleted ? 'just-completed' : ''} ${isImportant ? 'important-habit' : ''}" data-habit-id="${habit.id}" data-habit-name="${this.escapeHtml(habit.name.toLowerCase())}" data-habit-category="${this.escapeHtml(habit.category.toLowerCase())}">
            <div class="habit-info">
                <div class="habit-name">${this.escapeHtml(habit.name)}${isImportant ? '<span class="priority-chip">Top priority</span>' : ''}</div>
                <div class="habit-meta">
                    <span class="habit-type-chip ${typeMeta.className}">${typeMeta.icon} ${typeMeta.label}</span>
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
                <button class="btn btn-check ${typeMeta.className}" onclick="app.toggleHabitCompletion(${habit.id})" aria-pressed="${isCompleted ? 'true' : 'false'}">
                    <span class="habit-toggle" aria-hidden="true">${isCompleted ? '✓' : ''}</span>
                    <span>${this.getHabitActionText(habit, isCompleted)}</span>
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
    }
  }

  window.HabitItemComponent = HabitItemComponent;
})();

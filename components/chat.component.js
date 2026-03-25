(function () {
  class ChatComponent {
    constructor() {
      if (!window.HabitChatbotEngine) return;
      this.engine = new window.HabitChatbotEngine();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.chatComponent = new ChatComponent();
  });

  window.ChatComponent = ChatComponent;
})();

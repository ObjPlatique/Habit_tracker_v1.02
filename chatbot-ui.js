/**
 * Chatbot UI module
 * Handles rendering, toggling, and message bubbles.
 */
(function () {
  class ChatbotUI {
    constructor() {
      this.toggleButton = document.getElementById('chatbotToggleBtn');
      this.chatWindow = document.getElementById('chatbotWindow');
      this.closeButton = document.getElementById('chatbotCloseBtn');
      this.messageList = document.getElementById('chatbotMessages');
      this.form = document.getElementById('chatbotForm');
      this.input = document.getElementById('chatbotInput');
      this.typingIndicator = document.getElementById('chatbotTyping');
      this.suggestButton = document.getElementById('chatbotSuggestBtn');
      this.analyzeButton = document.getElementById('chatbotAnalyzeBtn');

      if (!this.toggleButton || !this.chatWindow || !this.messageList || !this.form || !this.input) {
        return;
      }

      this.toggleButton.addEventListener('click', () => this.toggleWindow());
      this.closeButton?.addEventListener('click', () => this.closeWindow());
    }

    toggleWindow() {
      this.chatWindow.classList.toggle('open');
      this.toggleButton.classList.toggle('active');
      if (this.chatWindow.classList.contains('open')) {
        this.input.focus();
      }
    }

    closeWindow() {
      this.chatWindow.classList.remove('open');
      this.toggleButton.classList.remove('active');
    }

    addMessage(role, text) {
      const bubble = document.createElement('div');
      bubble.className = `chatbot-message ${role}`;
      bubble.textContent = text;
      this.messageList.appendChild(bubble);
      this.scrollToBottom();
    }

    setTyping(isTyping) {
      if (!this.typingIndicator) return;
      this.typingIndicator.classList.toggle('show', isTyping);
      this.scrollToBottom();
    }

    setInputDisabled(disabled) {
      this.input.disabled = disabled;
      const sendButton = this.form.querySelector('button[type="submit"]');
      if (sendButton) sendButton.disabled = disabled;
    }

    scrollToBottom() {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }
  }

  window.ChatbotUI = ChatbotUI;
})();

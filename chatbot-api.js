/**
 * Chatbot API module
 * Uses OpenAI when API key exists. Falls back to a local mock assistant.
 */
(function () {
  function getApiKey() {
    return window.OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  }

  async function callOpenAI(message, habitsSummary, language) {
    const apiKey = getApiKey();
    if (!apiKey) {
      return null;
    }

    const systemPrompt = language === 'vie'
      ? 'Bạn là trợ lý theo dõi thói quen thân thiện. Trả lời ngắn gọn, thực tế, động viên. Đưa ra gợi ý hành động cụ thể.'
      : 'You are a friendly habit-tracking coach. Be concise, practical, and motivational. Give clear actionable suggestions.';

    const userPrompt = `${message}\n\nHabit summary:\n${habitsSummary}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  function mockAssistantReply(message, habitsData, language) {
    const lower = message.toLowerCase();
    const greeting = language === 'vie' ? '🤖 Chế độ demo: chưa có API key OpenAI.\n\n' : '🤖 Demo mode: no OpenAI API key configured yet.\n\n';

    if (lower.includes('fitness') || lower.includes('health') || lower.includes('thể dục')) {
      return greeting + (language === 'vie'
        ? 'Gợi ý thói quen sức khỏe: 20 phút đi bộ, 2 lít nước/ngày, và ngủ trước 11 giờ tối.'
        : 'Fitness habit ideas: 20-minute walk, 2L water/day, and sleeping before 11 PM.');
    }

    if (lower.includes('study') || lower.includes('learn') || lower.includes('học')) {
      return greeting + (language === 'vie'
        ? 'Gợi ý học tập: Pomodoro 25-5, ôn tập 10 phút trước khi ngủ, và ghi 3 ý chính sau mỗi buổi học.'
        : 'Study ideas: 25-5 Pomodoro, 10-minute review before bed, and write 3 key takeaways after each session.');
    }

    if (lower.includes('productivity') || lower.includes('năng suất')) {
      return greeting + (language === 'vie'
        ? 'Gợi ý năng suất: 3 nhiệm vụ quan trọng nhất mỗi sáng, tắt thông báo 45 phút deep-work, tổng kết cuối ngày 5 phút.'
        : 'Productivity ideas: pick top 3 priorities each morning, run 45-minute deep-work blocks, and do a 5-minute end-of-day review.');
    }

    if (language === 'vie') {
      return greeting + `Bạn đang có ${habitsData.totalHabits} thói quen, tỷ lệ hoàn thành hôm nay ${habitsData.todayCompletionRate}%. Hãy bắt đầu bằng một việc nhỏ nhất trong 2 phút để tạo đà nhé!`;
    }

    return greeting + `You currently have ${habitsData.totalHabits} habits and ${habitsData.todayCompletionRate}% completion today. Start with the smallest 2-minute action to build momentum.`;
  }

  async function sendMessageToAI(message, habitsData, language) {
    const habitsSummary = habitsData.rawSummary;

    try {
      const aiReply = await callOpenAI(message, habitsSummary, language);
      if (aiReply) return aiReply;
      return mockAssistantReply(message, habitsData, language);
    } catch (error) {
      console.warn('OpenAI unavailable, using mock assistant:', error);
      return mockAssistantReply(message, habitsData, language);
    }
  }

  window.sendMessageToAI = sendMessageToAI;
})();

/**
 * Chatbot API module
 * Uses OpenAI when API key exists. Falls back to a local mock assistant.
 */
(function () {
  function getApiKey() {
    return window.OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  }

  async function callOpenAI(message, habitsData, language) {
    const apiKey = getApiKey();
    if (!apiKey) {
      return null;
    }

    const systemPrompt = language === 'vie'
      ? 'Bạn là huấn luyện viên thói quen AI. Dựa vào dữ liệu localStorage của người dùng để: (1) phân tích thói quen hiện tại, (2) đưa lời khuyên cá nhân hóa ngắn gọn, (3) tạo báo cáo tuần với điểm mạnh/yếu, (4) gợi ý thói quen mới thực tế, (5) nếu thấy động lực thấp thì phản hồi đồng cảm và đề xuất bước rất nhỏ có thể làm ngay hôm nay. Luôn nhắc đến số liệu cụ thể như completion rate và streak khi có thể.'
      : 'You are an AI habit coach. Use the user\'s localStorage habit data to: (1) analyze current habits, (2) provide personalized advice, (3) produce weekly report insights, (4) suggest realistic new habits, and (5) when motivation appears low, respond empathetically with a tiny first step for today. Reference concrete metrics like completion rates and streaks whenever possible.';

    const userPrompt = [
      `User message: ${message}`,
      '',
      'Habit data from localStorage and app state:',
      JSON.stringify(habitsData, null, 2),
      '',
      'Respond in the same language as the user message. Keep it practical and supportive.'
    ].join('\n');

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
        max_tokens: 450
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
    const weekly = habitsData.weeklyReport || { currentWeekRate: 0, previousWeekRate: 0, weeklyChange: 0 };

    if (lower.includes('analyze') || lower.includes('progress') || lower.includes('báo cáo') || lower.includes('phân tích')) {
      if (language === 'vie') {
        return `${greeting}📊 Báo cáo tuần:\n• Tỷ lệ tuần này: ${weekly.currentWeekRate}%\n• Tuần trước: ${weekly.previousWeekRate}%\n• Thay đổi: ${weekly.weeklyChange}%\n\n✅ Gợi ý cá nhân hóa: Tập trung 1-2 thói quen có streak cao nhất (${habitsData.topHabits.join(', ') || 'chưa có'}) và đặt nhắc nhở cố định vào cùng khung giờ mỗi ngày.`;
      }
      return `${greeting}📊 Weekly report:\n• This week completion: ${weekly.currentWeekRate}%\n• Last week: ${weekly.previousWeekRate}%\n• Change: ${weekly.weeklyChange}%\n\n✅ Personalized advice: prioritize your top streak habits (${habitsData.topHabits.join(', ') || 'none yet'}) and set a fixed daily reminder window.`;
    }

    if (lower.includes('suggest') || lower.includes('gợi ý')) {
      return greeting + (language === 'vie'
        ? 'Gợi ý thói quen mới: (1) 10 phút đi bộ sau bữa trưa, (2) 5 phút tổng kết ngày, (3) chuẩn bị việc quan trọng nhất vào tối hôm trước.'
        : 'New habit ideas: (1) 10-minute walk after lunch, (2) 5-minute end-of-day reflection, (3) prepare tomorrow’s top task the night before.');
    }

    if (habitsData.motivationSignals?.needsSupport || lower.includes('tired') || lower.includes('burnout') || lower.includes('mệt') || lower.includes('nản')) {
      return greeting + (language === 'vie'
        ? `Mình thấy bạn có thể đang hơi thiếu động lực 💛. Hôm nay bạn mới hoàn thành ${habitsData.todayCompletionRate}% và streak trung bình là ${habitsData.avgStreak}. Hãy chọn 1 hành động cực nhỏ trong 2 phút (ví dụ: uống 1 cốc nước hoặc mở tài liệu học) để lấy lại đà.`
        : `It looks like motivation may be low 💛. Today you are at ${habitsData.todayCompletionRate}% completion with an average streak of ${habitsData.avgStreak}. Start with one tiny 2-minute action (drink water, open your study doc) to rebuild momentum.`);
    }

    if (language === 'vie') {
      return greeting + `Bạn có ${habitsData.totalHabits} thói quen. Hoàn thành hôm nay: ${habitsData.todayCompletionRate}%. Tuần này: ${weekly.currentWeekRate}%. Mình có thể gợi ý thói quen mới hoặc phân tích tiến độ chi tiết cho bạn.`;
    }

    return greeting + `You currently have ${habitsData.totalHabits} habits. Today: ${habitsData.todayCompletionRate}% completion. This week: ${weekly.currentWeekRate}%. I can suggest new habits or analyze your progress in detail.`;
  }

  async function sendMessageToAI(message, habitsData, language) {
    try {
      const aiReply = await callOpenAI(message, habitsData, language);
      if (aiReply) return aiReply;
      return mockAssistantReply(message, habitsData, language);
    } catch (error) {
      console.warn('OpenAI unavailable, using mock assistant:', error);
      return mockAssistantReply(message, habitsData, language);
    }
  }

  window.sendMessageToAI = sendMessageToAI;
})();

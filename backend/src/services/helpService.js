const config = require('../config');
const { retrieveKnowledge, normalizeQueryText } = require('./helpKnowledgeBase');

// Urgent symptom patterns for deterministic detection
const URGENT_SYMPTOM_PATTERNS = [
  /bleeding/i,
  /blood/i,
  /fever/i,
  /chills/i,
  /spreading redness/i,
  /redness spreading/i,
  /red streak/i,
  /pus/i,
  /yellow discharge/i,
  /green discharge/i,
  /discharge/i,
  /bad smell/i,
  /foul smell/i,
  /foul/i,
  /severe pain/i,
  /worsening pain/i,
  /throbbing pain/i,
  /increasing pain/i,
  /intense pain/i,
  /faint/i,
  /fainting/i,
  /fainted/i,
  /dizziness/i,
  /passed out/i,
  /black tissue/i,
  /black skin/i,
  /black wound/i,
  /black spot/i,
  /black color/i,
  /dead tissue/i,
  /dead-looking/i,
  /necrosis/i,
  /black skin/i,
  /animal bite/i,
  /snake bite/i,
  /dog bite/i,
  /cat bite/i,
  /diabetic/i,
  /diabetic foot/i,
  /difficulty breathing/i,
  /shortness of breath/i
];

function checkUrgentSymptoms(text) {
  if (!text) return false;
  return URGENT_SYMPTOM_PATTERNS.some(pattern => pattern.test(text));
}

class HelpService {
  /**
   * Process a general wound recovery question with RAG, deterministic rules,
   * conversation memory, and local fallback.
   * 
   * @param {string} userMessage
   * @param {Array<{ sender: string, text: string }>} [history=[]]
   * @returns {Promise<{ success: boolean, answer: string, hasUrgentSymptoms: boolean, category: string, source: string }>}
   */
  async processQuestion(userMessage, history = []) {
    const rawQuery = (userMessage || '').trim();
    if (!rawQuery) {
      return {
        success: false,
        answer: 'Please provide a valid question.',
        hasUrgentSymptoms: false,
        category: 'none',
        source: 'Validation'
      };
    }

    // 1. Deterministic Urgent Symptom Rule
    const hasUrgent = checkUrgentSymptoms(rawQuery);

    // 2. Resolve Context & Retrieval (including history for follow-ups)
    let fullQuery = rawQuery;
    if (history && history.length > 0) {
      const recentUserMsgs = history.filter(m => m.sender === 'user' || m.role === 'user').slice(-2);
      if (recentUserMsgs.length > 0) {
        fullQuery = `${recentUserMsgs.map(m => m.text).join(' ')} ${rawQuery}`;
      }
    }

    const retrieved = retrieveKnowledge(fullQuery);
    const category = retrieved.category || 'general recovery';

    // 3. AI Generation with RAG Context if AI is enabled
    if (config.ai.isEnabled) {
      try {
        const historyText = (history || []).slice(-4).map(m => 
          `${(m.sender || m.role) === 'user' ? 'User' : 'WoundWise'}: ${m.text}`
        ).join('\n');

        const systemInstruction = `You are the WoundWise general recovery assistant.

Answer general questions about wound care, nutrition, hydration, everyday activity, dressing care, hygiene, and recovery.

Use simple language suitable for patients and families.
Give general educational information only.

Do not diagnose wounds (never say "you have an infection", "this is infected", "your wound is safe", "you do not need a doctor", or "you are fully healed").
Do not claim a person is safe.
Do not prescribe medication, drug names, or medication doses.

When a question mentions urgent warning signs such as uncontrolled bleeding, fever with spreading redness, pus, severe worsening pain, bad smell, fainting, serious bites, or diabetic foot wounds, advise the person to seek medical attention promptly.

Keep responses concise, clear, and practical (2 to 4 short paragraphs or bullet points).`;

        const promptText = `${systemInstruction}

Retrieved Knowledge Base Context:
${retrieved.item.answer}

${historyText ? `Recent Conversation History:\n${historyText}\n` : ''}
User Question: "${rawQuery}"`;

        // Fetch Gemini API with 5-second timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.modelName}:generateContent?key=${config.ai.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: promptText }]
                }
              ]
            })
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawAnswer && rawAnswer.trim()) {
            return {
              success: true,
              answer: rawAnswer.trim(),
              hasUrgentSymptoms: hasUrgent,
              category,
              source: 'AI'
            };
          }
        }
      } catch (err) {
        console.warn('[Help AI Warning - Falling back to local knowledge base]:', err.message);
      }
    }

    // 4. Local Knowledge Base Fallback (Always resilient and reliable!)
    let fallbackAnswer = retrieved.item.answer;
    if (hasUrgent) {
      fallbackAnswer = `⚠️ Warning symptoms detected.\n\n${retrieved.item.answer}\n\nThese symptoms (such as fever, spreading redness, pus, foul smell, severe worsening pain, or uncontrolled bleeding) can be urgent warning signs that require prompt medical evaluation. Please consult a healthcare professional or visit a health facility.`;
    }

    return {
      success: true,
      answer: fallbackAnswer,
      hasUrgentSymptoms: hasUrgent,
      category,
      source: 'Local Knowledge Base'
    };
  }
}

module.exports = new HelpService();

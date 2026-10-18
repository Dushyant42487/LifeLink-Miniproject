/**
 * Ollama Client for local Llama-3.2-3B
 * Configured with 8k context window and strict health/wellness guardrails
 */

class OllamaClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.2:3b';
    this.numCtx = config.numCtx || 8192;
  }

  /**
   * Health query classification
   * Ensures the assistant only addresses health and wellness topics
   */
  classifyIntent(query) {
    const q = query.toLowerCase().trim();

    // Friendly greetings
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon', 'greetings'];
    if (greetings.includes(q) || /^(hi|hello|hey)\b/i.test(q)) {
      return {
        isHealth: true,
        isGreeting: true,
      };
    }

    // Obvious non-health indicators
    const nonHealthPatterns = [
      /\b(code|python|javascript|typescript|c\+\+|java|html|css|sql|git|npm|react|bash|powershell|regex|function|variable|bug|compile|algorithm)\b/i,
      /\b(crypto|bitcoin|ethereum|stock|shares|forex|invest|trading|nasdaq)\b/i,
      /\b(president|election|congress|senate|republican|democrat|parliament|politics)\b/i,
      /\b(car repair|engine oil|tire pressure|plumbing|mechanic)\b/i,
      /\b(movie review|celebrity|box office|nfl|nba|fifa|cricket score|super bowl)\b/i,
      /\b(solve|calculate)\s+\d+[\+\-\*\/]/i,
      /\b(math|algebra|calculus|geometry|quadratic)\b/i
    ];

    for (const pattern of nonHealthPatterns) {
      if (pattern.test(q)) {
        return {
          isHealth: false,
          reason: 'off-topic',
        };
      }
    }

    // Health-positive keywords & semantic patterns
    const healthKeywords = [
      'health', 'wellness', 'doctor', 'physician', 'hospital', 'clinic', 'nurse',
      'symptom', 'pain', 'ache', 'fever', 'headache', 'migraine', 'cough', 'cold', 'flu',
      'infection', 'virus', 'bacteria', 'blood', 'pressure', 'sugar', 'glucose', 'cholesterol',
      'heart', 'rate', 'pulse', 'bpm', 'cardio', 'lung', 'breath', 'breathing', 'asthma',
      'stomach', 'gut', 'digest', 'nausea', 'diet', 'nutrition', 'calorie', 'vitamin', 'mineral',
      'supplement', 'protein', 'water', 'hydration', 'sleep', 'insomnia', 'fatigue', 'tired',
      'energy', 'exercise', 'workout', 'stretch', 'posture', 'back', 'neck', 'joint', 'muscle',
      'stress', 'anxiety', 'calm', 'mental', 'mind', 'mood', 'depression', 'therapy', 'meditation',
      'medicine', 'pill', 'dose', 'medication', 'drug', 'prescription', 'allergy', 'rash', 'skin',
      'weight', 'bmi', 'lab', 'report', 'test', 'scan', 'mri', 'xray', 'ultrasound', 'document',
      'pdf', 'vital', 'vitals', 'guideline', 'hydration', 'fasting', 'recovery', 'heal', 'illness',
      'camp', 'camps', 'donation', 'donor', 'donate', 'eraktkosh', 'raktkosh', 'blood bank'
    ];

    const hasHealthKeyword = healthKeywords.some(kw => q.includes(kw));

    // If it mentions uploaded context, pdf, notes, reports, or health keywords:
    if (hasHealthKeyword || q.includes('report') || q.includes('notes') || q.includes('document')) {
      return { isHealth: true, isGreeting: false };
    }

    // Default to gentle prompt for general questions or borderline topics
    return { isHealth: true, isGreeting: false };
  }

  /**
   * Stream a chat response from Ollama
   */
  async streamChat({ messages, contextDocs = [], onChunk, onDone, onError }) {
    try {
      const lastUserMsg = messages[messages.length - 1]?.content || '';
      const classification = this.classifyIntent(lastUserMsg);

      // Guardrail trigger: if query is clearly unrelated to health
      if (!classification.isHealth) {
        const refusalMessage = 
          "I am your dedicated health and wellness companion. I can only assist with health questions, wellness guidance, nutrition, sleep, lifestyle, and reviewing your health records.\n\n" +
          "If you have a question about your wellbeing, symptoms, or a health document you'd like to discuss, please feel free to ask.";
        
        onChunk(refusalMessage);
        onDone(refusalMessage);
        return;
      }

      // Format knowledge graph context
      let contextPrompt = '';
      if (contextDocs && contextDocs.length > 0) {
        contextPrompt = '\n\n--- KNOWLEDGE BASE CONTEXT (From Atomic Knowledge Graph & Uploaded PDFs) ---\n';
        contextDocs.forEach((doc, idx) => {
          const title = doc.title || (doc.source_url ? `Document ${doc.source_url}` : `Note ${idx + 1}`);
          const content = doc.content || doc.text || (typeof doc === 'string' ? doc : JSON.stringify(doc));
          contextPrompt += `\n[Reference ${idx + 1}: ${title}]\n${content.substring(0, 1500)}\n`;
        });
        contextPrompt += '--- END OF CONTEXT ---\n';
      }

      const systemPrompt = `You are a calm, trustworthy, and human health & wellness companion.
Your goal is to provide supportive, clear, and reassuring health information.

GUIDELINES:
- ONLY answer questions related to health, wellness, medical education, symptoms, lifestyle, nutrition, sleep, mental wellbeing, and health records.
- Speak in a warm, empathetic, and clear human voice. Avoid clinical coldness, and avoid exaggerated AI cheerfulness or robotic jargon.
- Distinguish observations (facts/symptoms) from supportive suggestions (wellness practices).
- When knowledge base context is provided above, reference it gently and accurately.
- Always be honest about limitations: you provide educational wellness information, not definitive clinical diagnosis.
- For potentially concerning symptoms, calmly encourage consulting a qualified doctor or healthcare provider.
- Keep responses readable and well-structured with gentle paragraphs and bullet points where helpful. Do not cram everything into one block.
${contextPrompt}`;

      // Build message payload
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-6) // Keep last turns to fit comfortably within context
      ];

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: chatMessages,
          stream: true,
          options: {
            num_ctx: this.numCtx,
            temperature: 0.3,
            top_p: 0.9,
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama error ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep remainder

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            const chunk = data.message?.content || '';
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch {
            // Wait for full json
          }
        }
      }

      onDone(fullText);
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  }
}

module.exports = { OllamaClient };

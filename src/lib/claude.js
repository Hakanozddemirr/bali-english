import Anthropic from '@anthropic-ai/sdk'

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — en yetenekli (önerilen)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — hızlı ve dengeli' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — en hızlı ve ekonomik' },
]
export const DEFAULT_MODEL = 'claude-opus-5'

function trError(e) {
  if (e instanceof Anthropic.AuthenticationError)
    return 'API anahtarı geçersiz görünüyor. Ayarlar ekranından anahtarını kontrol et.'
  if (e instanceof Anthropic.PermissionDeniedError)
    return 'API anahtarının bu modele erişimi yok. Ayarlardan farklı bir model seç.'
  if (e instanceof Anthropic.NotFoundError)
    return 'Model bulunamadı. Ayarlardan farklı bir model seç.'
  if (e instanceof Anthropic.RateLimitError)
    return 'Çok fazla istek. Bir dakika bekleyip tekrar dene.'
  if (e instanceof Anthropic.APIConnectionError)
    return 'Bağlantı kurulamadı. İnternetini kontrol et (Claude modu çevrimdışı çalışmaz).'
  return 'Bir hata oluştu: ' + (e?.message || 'bilinmeyen hata').slice(0, 160)
}

const MODE_LINES = {
  guided:
    'MODE: GUIDED. Speak a little slower and simpler than normal (A2-friendly). Keep replies to 1–2 short sentences. If the learner seems stuck, gently offer a phrase they could use.',
  normal:
    'MODE: NORMAL. Natural, casual international traveler English — contractions, light fillers ("honestly", "I mean"), 1–3 sentences per reply.',
  realistic:
    'MODE: REALISTIC. Fully natural speed and phrasing. Occasionally change topics, tell short stories, or ask unexpected follow-up questions like a real person would. Still internationally understandable — no rare slang.',
}

// Rol yapma + serbest sohbet için ortak sistem promptu.
// personaLine ör: "Jake, a laid-back traveler from Australia who has been in Bali two weeks..."
export function buildTalkPrompt({ personaLine, settingEn, mode = 'normal' }) {
  return [
    `You are role-playing with an English learner who is preparing for a trip to Bali in a few days.`,
    `CHARACTER: You are ${personaLine}. Setting: ${settingEn}. Stay in character the whole time — you are a real traveler, not a teacher.`,
    MODE_LINES[mode] || MODE_LINES.normal,
    `LEARNER PROFILE: Lower-intermediate (A2/B1) Turkish adult. They understand common English and basic grammar but lack spontaneous speaking confidence. Do NOT use baby English or limit yourself to 8-word sentences. Do NOT use rare slang.`,
    `CONVERSATION STYLE:`,
    `- Sound like a real traveler: contractions, natural reactions ("No way!", "Fair enough"), casual questions.`,
    `- Most replies should end with a question or a hook that keeps the conversation alive.`,
    `- Vary your details naturally (places, plans, small stories). Occasionally invite the learner somewhere or suggest exchanging Instagram/WhatsApp.`,
    `CORRECTIONS: Do not interrupt mistakes. If meaning is clear, keep talking naturally. At most once every 3–5 turns, if there is a significant recurring mistake, give ONE quick natural recast in parentheses, e.g. (better: "I've been here for three days") — then continue the conversation immediately. Never lecture.`,
    `SPECIAL COMMANDS from the learner:`,
    `- "yardım" or "help" alone → give the Turkish translation of your previous message, then repeat it in English and continue.`,
    `- "[[hint]]" → in ≤10 words, suggest in English what they could say next (as a coach aside, in parentheses), then wait.`,
    `- "[[answer]]" → give one full natural sentence they could say, in quotes, then continue in character as if waiting for them to say it.`,
    `- "[[slower]]" → repeat your last message in slower, simpler English.`,
    `- "[[feedback]]" → END the role-play and give compact feedback in Turkish with EXACTLY these sections:`,
    `✅ İyi yaptıkların: (2-3 kısa madde)`,
    `🔧 En önemli düzeltmeler: (en fazla 3 satır, format: "yanlış cümle" → "doğru cümle")`,
    `💬 Daha doğal alternatifler: (2-4 madde)`,
    `⭐ Bu sohbetten kalıplar: (3-5 İngilizce kalıp)`,
    `🎯 Tekrar çalış: (1 madde)`,
    `Plain text only. No markdown headers, no emojis except the section markers above.`,
  ].join('\n')
}

export async function chatReply({ apiKey, model, system, history, maxTokens = 1024 }) {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
  })
  try {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      ...(model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' } }),
      messages: history,
    })
    if (res.stop_reason === 'refusal') return "Anyway — tell me more about your trip!"
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim()
    return text || 'Sorry, say that again?'
  } catch (e) {
    throw new Error(trError(e))
  }
}

// Geri bildirim metninden hata bankası satırlarını çek: "yanlış" → "doğru"
export function parseMistakes(feedbackText) {
  const out = []
  for (const line of feedbackText.split('\n')) {
    const m = line.match(/[“"']?(.+?)[”"']?\s*→\s*[“"']?(.+?)[”"']?\s*$/)
    if (m && m[1].length > 2 && m[2].length > 2 && !m[1].startsWith('✅')) {
      out.push({ orig: m[1].trim(), fix: m[2].trim() })
    }
  }
  return out.slice(0, 3)
}

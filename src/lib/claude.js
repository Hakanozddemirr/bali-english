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
    return 'API anahtarının bu modele erişim izni yok. Ayarlardan farklı bir model seçmeyi dene.'
  if (e instanceof Anthropic.NotFoundError)
    return 'Model bulunamadı. Ayarlardan farklı bir model seçmeyi dene.'
  if (e instanceof Anthropic.RateLimitError)
    return 'Çok fazla istek gönderildi. Bir dakika bekleyip tekrar dene.'
  if (e instanceof Anthropic.APIConnectionError)
    return 'Bağlantı kurulamadı. İnternet bağlantını kontrol et. (Sesli asistan çevrimdışı çalışmaz.)'
  if (e instanceof Anthropic.BadRequestError)
    return 'İstek reddedildi: ' + (e.message || '').slice(0, 160)
  return 'Bir hata oluştu: ' + (e?.message || 'bilinmeyen hata').slice(0, 160)
}

export function buildSystemPrompt(scenario) {
  return [
    `You are helping an absolute beginner from Turkey practice survival English for a trip to Bali, Indonesia.`,
    `ROLE-PLAY: You are ${scenario.role}.`,
    `Rules:`,
    `- Reply with ONE short, very simple English sentence — 8 to 10 words maximum. Use only basic vocabulary.`,
    `- Be warm, slow and patient. Stay in character; never break the role-play.`,
    `- Usually end with a simple question to keep the conversation going.`,
    `- If the user struggles, stays silent, or gives a confusing answer, suggest the exact sentence they should say and ask them to repeat it. Example: You can say: "One coffee, please." — Try it!`,
    `- Every 3-4 turns, gently correct ONE important mistake in the user's English in a few simple words, then continue the role-play.`,
    `- If the user says "help" or "yardım": give the Turkish translation of your last sentence, then repeat the sentence in English. This is the ONLY time you may use Turkish.`,
    `- Plain text only. No markdown, no emojis, no lists.`,
  ].join('\n')
}

// history: [{role:'user'|'assistant', content: string}, ...] — ilk eleman user olmalı.
export async function chatReply({ apiKey, model, system, history }) {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
  })
  try {
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      // Haiku 4.5 effort parametresini desteklemiyor; diğerlerinde hızlı yanıt için düşük tut.
      ...(model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' } }),
      messages: history,
    })
    if (res.stop_reason === 'refusal') {
      return "Sorry, let's talk about something else. Where are you going today?"
    }
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim()
    return text || 'Sorry, can you say that again?'
  } catch (e) {
    throw new Error(trError(e))
  }
}

import Anthropic from '@anthropic-ai/sdk'

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — en yetenekli (önerilen)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — hızlı ve dengeli' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — en hızlı ve ekonomik' },
]
export const DEFAULT_MODEL = 'claude-opus-5-5'
// Kısa kontroller (Lab cevabı) için hızlı ve ucuz model
export const FAST_MODEL = 'claude-haiku-4-5'

// Opus 5.5 / Sonnet 5.5: güvenlik sınıflandırıcısı reddederse sunucu otomatik yedek modele geçer
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

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
    'MODE: GUIDED. Simple A2 English, 1–2 short sentences per reply, ONE question at a time. End EVERY reply with a new line in exactly this format: "Try: <a short sentence frame that answers your question, with ___ for the parts he fills in>" — e.g. "Try: I went to ___ with ___." The frame must be easy and use the structure he is practising.',
  normal:
    'MODE: NORMAL. Natural, casual international traveler English — contractions, light fillers ("honestly", "I mean"), 1–3 sentences per reply.',
  realistic:
    'MODE: REALISTIC. Fully natural speed and phrasing. Occasionally change topics, tell short stories, or ask unexpected follow-up questions like a real person would. Still internationally understandable — no rare slang.',
}

// Rol yapma + serbest sohbet için ortak sistem promptu.
// personaLine ör: "Jake, a laid-back traveler from Australia who has been in Bali two weeks..."
export function buildTalkPrompt({ personaLine, settingEn, mode = 'normal', focus = null }) {
  return [
    `You are role-playing with an English learner. He is a Turkish entrepreneur (online clothing shop) who just spent a month in Bali and will go back in a few months.`,
    `CHARACTER: You are ${personaLine}. Setting: ${settingEn}. Stay in character the whole time — you are a real traveler, not a teacher.`,
    MODE_LINES[mode] || MODE_LINES.normal,
    `LEARNER PROFILE: Turkish adult, about A1+/A2-. He understands much more than he can say: listening is fine, but building his own sentences is hard. Typical mistakes: drops past tense ("I like" instead of "I liked"), forgets "want to", puts "the" before place names, gives 2-4 word answers. Use clear, everyday English; do NOT use baby English and do NOT use rare slang.`,
    `- If his answer is very short, ask a natural follow-up that invites a longer answer (why? with who? what was it like?).`,
    ...(focus ? [
      `TODAY'S FOCUS (he studied this grammar this morning): ${focus.pattern || focus.title}. Naturally ask questions that make him USE it — e.g. ${focus.questions.slice(0, 3).map((q) => `"${q}"`).join(', ')}. Don't mention it is practice.`,
      ...(focus.words?.length ? [`WORDS HE IS LEARNING (create chances to use 2-3 of them, naturally): ${focus.words.join(', ')}.`] : []),
    ] : []),
    `CONVERSATION STYLE:`,
    `- Sound like a real traveler: contractions, natural reactions ("No way!", "Fair enough"), casual questions.`,
    `- Most replies should end with a question or a hook that keeps the conversation alive.`,
    `- Vary your details naturally (places, plans, small stories). Occasionally invite the learner somewhere or suggest exchanging Instagram/WhatsApp.`,
    `CORRECTIONS: Do not interrupt the flow. About once every 2–3 turns, if there is a clear mistake (especially in today's focus), give ONE quick recast in parentheses, e.g. (better: "I liked the beach clubs") — then continue the conversation immediately. Never lecture.`,
    `MIXING TURKISH IS OK: when he doesn't know a word he may say it in Turkish (e.g. "I went to the plaj"). Then begin your reply with the word in brackets, e.g. [plaj = beach], and continue naturally. Never criticize mixing — it keeps him talking.`,
    `SPECIAL COMMANDS from the learner:`,
    `- "[[word: X]]" → X is a Turkish word or phrase he needs. Reply ONLY with: [X = English] + one very short example sentence, then repeat your last question in simple words.`,
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

function makeClient(apiKey) {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
  })
}

// Ortak istek: Haiku'da effort yok; Opus/Sonnet 5.5'te sunucu taraflı yedek model açık.
async function create(apiKey, { model, effort = 'low', format, ...rest }) {
  const client = makeClient(apiKey)
  const output_config = {
    ...(model === 'claude-haiku-4-5' ? {} : { effort }),
    ...(format ? { format } : {}),
  }
  const params = { model, ...rest, ...(Object.keys(output_config).length ? { output_config } : {}) }
  if (FALLBACK_MODELS.has(model)) {
    try {
      return await client.beta.messages.create({ ...params, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] })
    } catch (e) {
      // Yedek model özelliği bu hesapta kapalıysa isteği sade haliyle tekrarla
      if (!(e instanceof Anthropic.BadRequestError)) throw e
    }
  }
  return client.messages.create(params)
}

const textOf = (res) => res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim()

export async function chatReply({ apiKey, model, system, history, maxTokens = 1024 }) {
  try {
    const res = await create(apiKey, { model, max_tokens: maxTokens, system, messages: history })
    if (res.stop_reason === 'refusal') return "Anyway — tell me more about your trip!"
    const text = textOf(res)
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

// Yapılandırılmış (JSON şemalı) tek seferlik istek
export async function askJSON({ apiKey, model, system, user, schema, maxTokens = 4000, effort = 'low' }) {
  try {
    const res = await create(apiKey, {
      model, max_tokens: maxTokens, system, effort,
      format: { type: 'json_schema', schema },
      messages: [{ role: 'user', content: user }],
    })
    if (res.stop_reason === 'refusal') throw new Error('Bu istek yanıtlanamadı.')
    return JSON.parse(textOf(res))
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('Cevap okunamadı, tekrar dene.')
    if (e.message && !(e instanceof Anthropic.APIError)) throw e
    throw new Error(trError(e))
  }
}

const COACH = `You are a friendly English coach for a Turkish adult learner (about A1+/A2-) who understands English much better than he can speak it. All explanations must be in Turkish, short and concrete. Never lecture.`

// Lab cevabı yerel eşleşmede tutmadıysa: anlamca ve gramerce doğru mu?
export async function judgeLabAnswer({ apiKey, tr, expected, attempt, focus }) {
  return askJSON({
    apiKey, model: FAST_MODEL,
    system: COACH,
    user: `Turkish sentence: "${tr}"\nModel answer(s): ${expected.map((e) => `"${e}"`).join(' / ')}\nToday's structure: ${focus}\nLearner said (may come from speech recognition, ignore capitalization/punctuation): "${attempt}"\n\nIs the learner's sentence a correct, natural English translation (it does not have to match the model answer word for word)? If not, give the corrected version closest to what he said and a one-line Turkish explanation of the main error.`,
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        corrected: { type: 'string', description: 'Correct sentence closest to the attempt (same as attempt if ok)' },
        noteTr: { type: 'string', description: 'Max 15 words, Turkish' },
      },
      required: ['ok', 'corrected', 'noteTr'],
      additionalProperties: false,
    },
    maxTokens: 400,
  })
}

// Hazır içeriği olmayan ders için Lab üret
export async function generateLab({ apiKey, model, lesson }) {
  return askJSON({
    apiKey, model, effort: 'medium',
    system: `${COACH} You write practice items for a speaking drill: he sees a Turkish sentence and must say it in English.`,
    user: `Grammar lesson: "${lesson.title}" (level: ${lesson.level}). Write a speaking drill for this structure.
- focusTr: 1-2 short Turkish sentences, the single most useful rule for SPEAKING.
- pattern: compact formula.
- items: exactly 12. Items 1-4 are 3-5 words with no commas. Items 5-8: 5-8 words. Items 9-12: longer with and/because/but. Every item uses the lesson structure.
- Topics from his life: his online clothing shop, customers, gym, coffee, Istanbul, Bali/Canggu, scooter, beach, villa, friends, travel.
- en: all natural accepted variants (contractions and full forms), max 6.
- tip: optional Turkish hint for a classic Turkish-speaker trap, else empty string.
- talk: 3 short English questions that make him use this structure.`,
    schema: {
      type: 'object',
      properties: {
        focusTr: { type: 'string' },
        pattern: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tr: { type: 'string' },
              en: { type: 'array', items: { type: 'string' } },
              tip: { type: 'string' },
            },
            required: ['tr', 'en', 'tip'],
            additionalProperties: false,
          },
        },
        talk: { type: 'array', items: { type: 'string' } },
      },
      required: ['focusTr', 'pattern', 'items', 'talk'],
      additionalProperties: false,
    },
    maxTokens: 6000,
  })
}

// Serbest metin düzeltme: günlük, kitap özeti, haftalık kontrol
export async function correctText({ apiKey, model, text, task }) {
  return askJSON({
    apiKey, model,
    system: COACH,
    user: `Task he was doing: ${task}\nHis English (may come from speech recognition — ignore punctuation and capitalization):\n"""${text}"""\n\nCorrect it. Keep his meaning and his simple style; do not make it fancy. List only real mistakes (max 5). Then give ONE natural, slightly richer version he could say next time (still A2 level).`,
    schema: {
      type: 'object',
      properties: {
        corrected: { type: 'string' },
        mistakes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              wrong: { type: 'string' },
              right: { type: 'string' },
              noteTr: { type: 'string' },
            },
            required: ['wrong', 'right', 'noteTr'],
            additionalProperties: false,
          },
        },
        better: { type: 'string' },
        praiseTr: { type: 'string', description: 'One short Turkish sentence about what he did well' },
      },
      required: ['corrected', 'mistakes', 'better', 'praiseTr'],
      additionalProperties: false,
    },
    maxTokens: 2000,
  })
}

// Haftalık konuşma kontrolü: kaba ilerleme puanı (bilimsel değil, haftalar arası kıyas için)
export async function weeklyCheck({ apiKey, model, text, seconds }) {
  return askJSON({
    apiKey, model, effort: 'medium',
    system: COACH,
    user: `Weekly speaking check. He talked for about ${seconds} seconds about his week. Speech-recognition transcript:\n"""${text}"""\n\nScore 1-10 for: fluency (how much and how connected he says), accuracy (grammar), range (variety of words/structures). Be honest and consistent so weeks can be compared. Then the 3 most important fixes and one concrete focus for next week, in Turkish.`,
    schema: {
      type: 'object',
      properties: {
        fluency: { type: 'integer' },
        accuracy: { type: 'integer' },
        range: { type: 'integer' },
        fixes: {
          type: 'array',
          items: {
            type: 'object',
            properties: { wrong: { type: 'string' }, right: { type: 'string' }, noteTr: { type: 'string' } },
            required: ['wrong', 'right', 'noteTr'],
            additionalProperties: false,
          },
        },
        nextFocusTr: { type: 'string' },
        summaryTr: { type: 'string' },
      },
      required: ['fluency', 'accuracy', 'range', 'fixes', 'nextFocusTr', 'summaryTr'],
      additionalProperties: false,
    },
    maxTokens: 2000,
  })
}

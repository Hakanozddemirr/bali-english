// Çevrimdışı sohbet motoru: kabul-öncelikli. Anlaşılır her deneme kabul edilir;
// beklenen anahtar yakalanırsa daha sıcak tepki verilir. Amaç: konuşma pratiği.
import { grade } from './match'

const ACKS = ['Nice!', 'Oh cool.', 'Right.', 'Haha, yeah.', 'Totally.', 'For sure.', 'Gotcha.']
const WARM = ['Oh nice!', 'No way, really?', 'Love that.', 'Haha, brilliant.']
const NUDGES = ["Sorry, what was that?", "Hmm? Say that again?", "Sorry — one more time?"]

export function pickPersona(list) {
  return list[(Math.random() * list.length) | 0]
}

export function fill(template, persona) {
  if (!template) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => persona?.[k] ?? `{${k}}`)
}

// dönüş: {reply, trOfReply, advance, nudged, coach}
// coach = kullanıcıya gösterilecek "daha doğal örnek" (mod'a göre gösterilir/gizlenir)
export function runBeatTurn({ beats, idx, persona, text }) {
  const beat = beats[idx]
  const g = grade(text, { keys: beat.need ? [beat.need] : null, samples: beat.sample ? [fill(beat.sample, persona)] : null })
  if (g === 'weak') {
    return { reply: NUDGES[(Math.random() * NUDGES.length) | 0], advance: false, nudged: true }
  }
  const nextIdx = idx + 1
  const done = nextIdx >= beats.length
  const ackPool = g === 'strong' ? WARM : ACKS
  const ack = Math.random() < 0.7 ? ackPool[(Math.random() * ackPool.length) | 0] + ' ' : ''
  if (done) {
    return { reply: `${ack}This was fun — good luck out there!`, advance: true, done: true }
  }
  const next = beats[nextIdx]
  return {
    reply: ack + fill(next.ai, persona),
    trOfReply: fill(next.tr, persona),
    advance: true,
    coach: beat.sample ? fill(beat.sample, persona) : null,
  }
}

// Basit çevrimdışı oturum sonu geri bildirimi
export function offlineFeedback({ turns, nudges, dayChunks }) {
  const lines = []
  lines.push('🏁 Konuşma bitti!')
  lines.push(`✅ ${turns} kez söz aldın${nudges ? `, ${nudges} kez tekrar soruldu` : ' — hiç takılmadan!'}.`)
  if (dayChunks?.length) {
    const picks = dayChunks.slice(0, 4).map((c) => `“${c.en}”`).join(' · ')
    lines.push(`⭐ Bugünün kalıplarını sohbetine kat: ${picks}`)
  }
  lines.push('🎯 İpucu: her cevabının sonuna bir soru ekle — sohbet hiç kopmaz.')
  return lines.join('\n')
}

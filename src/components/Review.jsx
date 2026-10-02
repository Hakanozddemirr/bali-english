import { useMemo, useState } from 'react'
import { useApp, ensureLog } from '../lib/store'
import { dueCards, gradeCard, addCard, CARD_TYPES } from '../lib/cards'
import { checkSentence } from '../lib/match'
import { speak } from '../lib/tts'
import { allChunkList } from '../content'
import { sample } from '../lib/quizGen'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'
import WordDiff from './WordDiff'

// Kartın ön yüzü: her zaman ÜRETİM yönü (Türkçe/hata → İngilizce söyle)
function front(c) {
  if (c.type === 'mistake') return { label: 'Bu cümlenin doğrusunu söyle', text: `❌ ${c.ex}`, checkable: true }
  if (c.tr) return { label: 'İngilizce söyle', text: `🇹🇷 ${c.tr}`, checkable: true }
  return { label: 'Bu ifadeyle kendi cümleni kur', text: c.en, checkable: false }
}

export default function Review({ onBack }) {
  const { state, update } = useApp()
  const rate = state.settings.rate
  // Oturum başında listeyi dondur (cevapladıkça vadesi değişir)
  const [queue] = useState(() => dueCards(state).map((c) => c.id))
  const [i, setI] = useState(0)
  const [res, setRes] = useState(null) // {attempt, check}
  const [score, setScore] = useState({ ok: 0, miss: 0 })
  const [extra, setExtra] = useState(null) // vadesi gelen yoksa hızlı tur

  const ids = extra || queue
  const card = state.cards[ids[i]]
  const finished = ids.length > 0 && i >= ids.length

  const markLog = (n) => update((s) => { const l = ensureLog(s); l.review = true; l.reviewCount += n })

  const quickRound = () => {
    const all = Object.keys(state.cards)
    if (all.length >= 4) { setExtra(sample(all, Math.min(8, all.length))); setI(0); return }
    // Hiç kart yoksa Bali paketinden başlangıç kartları ekle
    const picks = sample(allChunkList.filter((c) => !state.known[c.id]), 8)
    const next = update((s) => picks.forEach((c) => addCard(s, { type: 'word', en: c.en, tr: c.tr, ex: c.ex, src: 'Bali paketi' })))
    setExtra(picks.map((c) => Object.values(next.cards).find((x) => x.en === c.en)?.id).filter(Boolean))
    setI(0)
  }

  const f = card && front(card)

  const submit = (attempt) => {
    if (!f.checkable) { setRes({ attempt, check: null }); return }
    const check = checkSentence(attempt, [card.en])
    setRes({ attempt, check })
    speak(card.en, rate)
  }

  const grade = (correct) => {
    update((s) => gradeCard(s, card.id, correct))
    setScore((x) => ({ ok: x.ok + (correct ? 1 : 0), miss: x.miss + (correct ? 0 : 1) }))
    setRes(null)
    const ni = i + 1
    if (ni >= ids.length) { markLog(ids.length); fireConfetti(1200) }
    setI(ni)
  }

  const header = (
    <div className="topbar">
      <button className="back-btn" onClick={onBack}>←</button>
      <h2>🔁 Tekrar</h2>
      {ids.length > 0 && !finished && <span className="timer-chip">{i + 1}/{ids.length}</span>}
    </div>
  )

  if (!ids.length) {
    return (
      <div className="screen">
        {header}
        <div className="task-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>🌤️</div>
          <p className="desc">Bugün vadesi gelen kart yok. Kitaptan kelime ekledikçe, Lab'da ve konuşmada hata yaptıkça burası dolacak.</p>
          <button className="btn primary" onClick={quickRound}>⚡ 2 dk hızlı tur</button>
        </div>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="screen">
        {header}
        <div className="task-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>✅</div>
          <p className="desc">Tekrar bitti: {score.ok} bildin, {score.miss} tekrar gelecek. Bilemediklerin yarın tekrar karşına çıkacak.</p>
          <button className="btn primary" onClick={onBack}>Bugün ekranına dön</button>
        </div>
      </div>
    )
  }

  const verdict = res?.check?.verdict
  return (
    <div className="screen">
      {header}
      <div className="q-prompt">
        <div className="hint" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>
          {CARD_TYPES[card.type]?.icon} {CARD_TYPES[card.type]?.label}{card.src ? ` · ${card.src}` : ''} — {f.label}
        </div>
        <div className="word" style={{ fontSize: 22 }}>{f.text}</div>
      </div>

      {!res ? (
        <>
          <AnswerInput onSubmit={submit} placeholder="İngilizcesini söyle ya da yaz…" />
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => { setRes({ attempt: '', check: null, gaveUp: true }); speak(card.en, rate) }}>
            🙈 Bilmiyorum, göster
          </button>
        </>
      ) : (
        <div className="task-card">
          {res.attempt && <div className="heard-line">Sen: “{res.attempt}”</div>}
          {verdict === 'correct' && <div className="feedback good">✅ Doğru!</div>}
          {verdict === 'close' && <div className="feedback" style={{ color: 'var(--gold)' }}>🟡 Çok yakın — farka bak</div>}
          {verdict === 'wrong' && <div className="feedback bad">❌ Doğrusu:</div>}
          {res.check?.diff && verdict !== 'correct' && <WordDiff diff={res.check.diff} />}
          <div className="phrase" style={{ boxShadow: 'none', background: 'var(--accent-soft)' }}>
            <div className="txt">
              <div className="en">{card.en}</div>
              {card.tr && <div className="tr">{card.tr}</div>}
            </div>
            <button className="speaker" onClick={() => speak(card.en, rate)}>🔊</button>
          </div>
          {!f.checkable && res.attempt && <p className="desc">Cümleni kurdun mu? İfadeyi doğru kullandıysan "Bildim" de.</p>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn danger" onClick={() => grade(false)}>Bilemedim</button>
            <button className="btn primary" onClick={() => grade(true)}
              disabled={res.gaveUp}>
              {verdict === 'wrong' ? 'Aslında bildim' : 'Bildim'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useApp, ensureLog, getLog } from '../lib/store'
import { addCard } from '../lib/cards'
import { bookVideos, ytLink } from '../lib/course'
import CoachText from './CoachText'

const TOTAL = 50
const WORD_LIMIT = 5

function WordForm() {
  const { state, update } = useApp()
  const log = getLog(state)
  const [en, setEn] = useState('')
  const [tr, setTr] = useState('')
  const [ex, setEx] = useState('')
  const [msg, setMsg] = useState('')
  const left = WORD_LIMIT - log.words

  const add = () => {
    if (!en.trim() || !tr.trim()) { setMsg('İngilizce ve Türkçe ikisi de gerekli.'); return }
    update((s) => {
      addCard(s, { type: 'word', en, tr, ex, src: 'Kitap' })
      ensureLog(s).words += 1
    })
    setEn(''); setTr(''); setEx(''); setMsg(`✅ “${en.trim()}” eklendi — tekrar destende.`)
  }

  return (
    <div className="task-card">
      <div className="head"><span className="ico">📗</span><span className="name">Günün kelimeleri</span><span className="min-chip">{Math.max(0, left)} hak</span></div>
      <div className="sample-box">
        <b>Filtre:</b> “Bu kelimeyi önümüzdeki ay <u>söyler miyim</u>?” Evet → ekle. Hayır (inşaatçı, tencere…) → bulmacada çöz, geç.
        Tanıman yeterli, ezberleme. Günde en fazla {WORD_LIMIT}.
      </div>
      {left > 0 ? (
        <>
          <div className="field"><input value={en} onChange={(e) => setEn(e.target.value)} placeholder="İngilizce (ör. customer)" autoCapitalize="off" /></div>
          <div className="field"><input value={tr} onChange={(e) => setTr(e.target.value)} placeholder="Türkçe (ör. müşteri)" /></div>
          <div className="field"><input value={ex} onChange={(e) => setEx(e.target.value)} placeholder="Kendi örnek cümlen (önerilir)" autoCapitalize="off" /></div>
          <button className="btn soft" onClick={add}>+ Tekrar destesine ekle</button>
        </>
      ) : (
        <p className="desc">Bugünkü 5 kelime tamam. Fazlası unutulur — yarın devam.</p>
      )}
      {msg && <p className="desc" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  )
}

export default function Book({ onBack }) {
  const { state, update } = useApp()
  const log = getLog(state)
  const r = Math.min(TOTAL, state.book.reading + 1)
  const p = Math.min(TOTAL, state.book.puzzle + 1)
  const readDoneToday = log.bookParts.includes('reading')
  const puzDoneToday = log.bookParts.includes('puzzle')
  const [retell, setRetell] = useState(readDoneToday)

  const finishPart = (part) => update((s) => {
    const l = ensureLog(s)
    if (l.bookParts.includes(part)) return
    l.bookParts.push(part)
    if (part === 'reading') s.book.reading = Math.min(TOTAL, s.book.reading + 1)
    if (part === 'puzzle') s.book.puzzle = Math.min(TOTAL, s.book.puzzle + 1)
    if (l.bookParts.includes('reading') && l.bookParts.includes('puzzle')) l.book = true
  })

  const undo = (part) => update((s) => {
    const l = ensureLog(s)
    if (!l.bookParts.includes(part)) return
    l.bookParts = l.bookParts.filter((x) => x !== part)
    l.book = false
    if (part === 'reading') s.book.reading = Math.max(0, s.book.reading - 1)
    if (part === 'puzzle') s.book.puzzle = Math.max(0, s.book.puzzle - 1)
  })

  const readNo = readDoneToday ? state.book.reading : r
  const puzNo = puzDoneToday ? state.book.puzzle : p

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>📚 Kitap</h2>
        <span className="timer-chip">~15 dk</span>
      </div>

      <div className="task-card">
        <div className="head">
          <span className="ico">📖</span>
          <span className="name">50 Basic Reading Passages · Metin #{readNo}</span>
          <span className="st">{readDoneToday ? '✅' : '○'}</span>
        </div>
        <ol className="steps">
          <li>Metni oku — Türkçeye bakmadan önce anlamaya çalış.</li>
          <li>Kitabın dinleme kısmını dinle, sonra cümle cümle <b>gölgele</b> (aynı anda tekrar et).</li>
          <li>Soruları çöz, cevabı kontrol et.</li>
          <li><b>Kitabı kapat → metni 3 cümleyle sesli anlat</b> (aşağıda).</li>
        </ol>
        {!retell ? (
          <button className="btn soft" onClick={() => setRetell(true)}>Okudum → 3 cümleyle anlat</button>
        ) : (
          <CoachText
            task={`Retell reading passage #${readNo} from the book "50 Basic Reading Passages" in 3 sentences, from memory.`}
            placeholder="This text is about… / First… / In the end…"
            minWords={12}
            doneLabel={readDoneToday ? '✅ Okuma tamam' : null}
            onDone={() => finishPart('reading')}
          />
        )}
        {readDoneToday && <button className="link-btn" onClick={() => undo('reading')}>↺ Yanlışlıkla işaretledim</button>}
      </div>

      <div className="task-card">
        <div className="head">
          <span className="ico">🧩</span>
          <span className="name">1000 Words With Puzzles · Blok #{puzNo}</span>
          <span className="st">{puzDoneToday ? '✅' : '○'}</span>
        </div>
        <div className="desc">
          Bulmaca <b>{puzNo * 2 - 1}</b> ve <b>{puzNo * 2}</b> + Eşleştirme <b>{puzNo}</b>. Kitapta düzen: 2 bulmaca + 1 eşleştirme.
          Bilmediğin kelimelerin hepsini değil, sadece <b>kullanacaklarını</b> aşağıya ekle.
        </div>
        {puzDoneToday ? (
          <button className="link-btn" onClick={() => undo('puzzle')}>↺ Yanlışlıkla işaretledim</button>
        ) : (
          <button className="btn soft" onClick={() => finishPart('puzzle')}>Bloğu bitirdim</button>
        )}
      </div>

      <WordForm />

      <div className="section-title">Hocanın kitap videoları</div>
      <div className="task-card">
        {[...bookVideos.reading, ...bookVideos.puzzle, ...bookVideos.vocab].map((v) => (
          <a key={v.id} className="vid-link" href={ytLink(v.id)} target="_blank" rel="noreferrer">▶ {v.title}</a>
        ))}
        <p className="desc" style={{ marginTop: 8, marginBottom: 0 }}>Takıldığın bir metin ya da bulmaca varsa hocanın birlikte çözdüğü videolar.</p>
      </div>
    </div>
  )
}

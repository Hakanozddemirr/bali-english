export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample(arr, n) {
  return shuffle(arr).slice(0, n)
}

// Üretim ağırlıklı 10 soruluk test:
// 2 tanıma + 2 dinleme (1 seçme + 1 yazma) + 3 konuşma + 2 devam ettirme + 1 gramer
export function buildQuiz(day, allChunkList, allDays) {
  const isFinal = !day.chunks.length
  const chunkPool = isFinal ? allChunkList : day.chunks
  const socialPool = isFinal
    ? allDays.flatMap((d) => d.social.filter((s) => s.type !== 'story'))
    : day.social.filter((s) => s.type !== 'story')
  const quickPool = isFinal ? allDays.flatMap((d) => d.quick) : day.quick
  const grammarPool = isFinal ? allDays.flatMap((d) => d.grammar.drills) : day.grammar.drills

  const rec = sample(chunkPool.filter((c) => c.tr), 2).map((c) => ({
    type: 'rec',
    tr: c.tr,
    correct: c.en,
    options: shuffle([c.en, ...sample(chunkPool.filter((x) => x.en !== c.en), 3).map((x) => x.en)]),
  }))

  const lChoose = sample(day.listening, 1).map((l) => ({
    type: 'listen-choose',
    audio: l.audio,
    q: l.q,
    correct: l.options[0],
    options: shuffle([...l.options]),
  }))

  const lType = sample(chunkPool.filter((c) => c.en.length < 45 && !c.en.includes('___')), 1).map(
    (c) => ({ type: 'listen-type', audio: c.en }),
  )

  const speak = sample(quickPool, 2).map((q) => ({ type: 'speak-quick', q: q.q, samples: [q.sample] }))

  const reacts = sample(socialPool.filter((s) => s.type === 'react'), 1).map((s) => ({
    type: 'speak-react', stmt: s.stmt, samples: s.samples,
  }))
  const follows = sample(socialPool.filter((s) => s.type === 'follow' || s.type === 'build'), 2).map(
    (s) => ({ type: 'speak-follow', stmt: s.stmt, samples: s.samples }),
  )

  const grammar = sample(grammarPool, 1).map((g) => ({
    type: 'grammar', tr: g.tr, keys: g.keys, best: g.best,
  }))

  return shuffle([...rec, ...lChoose, ...lType, ...speak, ...reacts, ...follows, ...grammar])
}

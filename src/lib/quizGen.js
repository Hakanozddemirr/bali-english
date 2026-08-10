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

// 10 soruluk günlük sınav: 5 görsel-kelime + 3 senaryo + 2 dinleme.
// JSON'da doğru cevap her zaman options[0]'dadır; burada karıştırılır.
export function buildQuiz(dayContent, allWords) {
  const pool = dayContent.words.length >= 5 ? dayContent.words : sample(allWords, 12)

  const matching = sample(pool, 5).map((w) => ({
    type: 'match',
    visual: w.v,
    img: w.img || null,
    correct: w.en,
    options: shuffle([w.en, ...sample(pool.filter((x) => x.en !== w.en), 3).map((x) => x.en)]),
  }))

  const situations = dayContent.quiz.situations.map((q) => ({
    type: 'sit',
    q: q.q,
    correct: q.options[0],
    options: shuffle([...q.options]),
  }))

  const listening = dayContent.quiz.listening.map((q) => ({
    type: 'listen',
    audio: q.audio,
    q: q.q,
    correct: q.options[0],
    options: shuffle([...q.options]),
  }))

  return shuffle([...matching, ...situations, ...listening])
}

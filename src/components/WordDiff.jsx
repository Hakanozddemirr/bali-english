// Hedef cümlede hangi kelimeler tuttu / eksik — compareSentence çıktısını gösterir
export default function WordDiff({ diff }) {
  if (!diff?.targetWords?.length) return null
  return (
    <div className="word-result">
      {diff.targetWords.map((w, i) => (
        <span key={i} className={diff.matched[i] ? 'hit' : 'miss'}>{w}</span>
      ))}
    </div>
  )
}

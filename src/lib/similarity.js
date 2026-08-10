// Hedef cümle ile konuşma tanıma çıktısını kelime bazında karşılaştırır.

const NUM_WORDS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven',
  8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen',
  15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty',
  50: 'fifty', 100: 'one hundred', 1000: 'one thousand',
}

export function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\b(\d+)\b/g, (m) => NUM_WORDS[Number(m)] || m)
    .replace(/\s+/g, ' ')
    .trim()
}

function lev(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

function wordsMatch(a, b) {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && lev(a, b) <= 1) return true
  return false
}

// LCS hizalaması: hedef cümledeki her kelime için eşleşti/eşleşmedi bilgisi döner.
export function compareSentence(target, heard) {
  const T = normalize(target).split(' ').filter(Boolean)
  const H = normalize(heard).split(' ').filter(Boolean)
  const m = T.length, n = H.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = wordsMatch(T[i], H[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])

  const matched = Array(m).fill(false)
  let i = 0, j = 0
  while (i < m && j < n) {
    if (wordsMatch(T[i], H[j])) { matched[i] = true; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  const score = m === 0 ? 0 : matched.filter(Boolean).length / m
  return { targetWords: T, matched, score, heard: H.join(' ') }
}

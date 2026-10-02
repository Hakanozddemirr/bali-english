// Aksen Kahraman YouTube müfredatı + Yapı Laboratuvarı içerikleri
import courseData from '../content/course.json'

const labParts = import.meta.glob('../content/lab/*.json', { eager: true, import: 'default' })
export const LAB = Object.assign({}, ...Object.values(labParts))

export const PLAYLIST_URL = courseData.source
export const lessons = courseData.lessons
export const sessions = courseData.sessions // [[lessonKey, ...], ...] — günlük seanslar
export const bookVideos = courseData.bookVideos
export const lessonByKey = Object.fromEntries(lessons.map((l) => [l.key, l]))

export const isReview = (l) => l.videos.every((v) => v.kind === 'tekrar')

// Ders tamam: videolar izlendi (ya da "biliyorum" ile geçildi) + Lab bitti
export function lessonDone(state, key) {
  return !!state.course.done[key]
}

export function sessionDone(state, idx) {
  return sessions[idx].every((k) => lessonDone(state, k))
}

// Sıradaki seans: tamamlanmamış ilk seans
export function nextSessionIdx(state) {
  const i = sessions.findIndex((_, idx) => !sessionDone(state, idx))
  return i === -1 ? sessions.length - 1 : i
}

export const sessionMinutes = (idx) =>
  Math.round(sessions[idx].reduce((a, k) => a + lessonByKey[k].videos.reduce((b, v) => b + v.dur, 0), 0) / 60)

export function labFor(state, key) {
  return LAB[key] || state.labCache?.[key] || null
}

export const lessonLabel = (l) => (l.n ? `Ders ${l.n}` : isReview(l) ? 'Tekrar' : 'Ek ders')

export const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`
export const ytLink = (id) => `https://www.youtube.com/watch?v=${id}`

export const fmtDur = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

export const courseProgress = (state) => {
  const total = lessons.length
  const done = lessons.filter((l) => lessonDone(state, l.key)).length
  return { done, total, pct: Math.round((done / total) * 100) }
}

// Bugünün odak yapısı: bugün çalışılan (ya da en son açılan) ders — Konuşma ve Günlük bunu kullanır
export function todayFocus(state, todayLessons) {
  const keys = todayLessons?.length ? todayLessons : sessions[nextSessionIdx(state)]
  const key = keys[keys.length - 1]
  const lesson = lessonByKey[key]
  const lab = labFor(state, key)
  return {
    key,
    title: lesson.title,
    pattern: lab?.pattern || lesson.title,
    questions: lab?.talk || [],
  }
}

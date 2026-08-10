const COLORS = ['#FF7A59', '#0E9F8F', '#F5B840', '#FF9FB2', '#7CD4C8', '#FFD98E']

export function fireConfetti(durationMs = 2200) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const W = window.innerWidth
  const H = window.innerHeight
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.5,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vy: 2 + Math.random() * 3.5,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * Math.PI,
    vr: -0.15 + Math.random() * 0.3,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  }))

  const start = performance.now()
  function tick(now) {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    for (const p of parts) {
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.globalAlpha = Math.max(0, 1 - t / durationMs)
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (t < durationMs) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

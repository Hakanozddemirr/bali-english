import { useRef, useState } from 'react'
import { startListening, sttSupported } from '../lib/stt'
import { stopSpeaking } from '../lib/tts'

// Ortak cevap girişi: mikrofon + klavye. Mikrofon yoksa yazma her zaman çalışır.
export default function AnswerInput({ onSubmit, placeholder = 'Konuş ya da yaz…', disabled }) {
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')
  const recRef = useRef(null)

  const send = (text) => {
    const t = (text ?? input).trim()
    if (!t || disabled) return
    setInput('')
    onSubmit(t)
  }

  const toggleMic = () => {
    if (disabled) return
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    setErr('')
    stopSpeaking()
    recRef.current = startListening({
      onInterim: (t) => setInput(t),
      onFinal: (t) => {
        setListening(false)
        send(t)
      },
      onError: (m) => {
        setErr(m)
        setListening(false)
      },
      onEnd: () => setListening(false),
    })
    if (recRef.current) setListening(true)
  }

  return (
    <div>
      {err && <div className="error-box">{err}</div>}
      <div className="chat-input" style={{ padding: '6px 0' }}>
        {sttSupported && (
          <button className={`round-btn ${listening ? 'rec' : ''}`} onClick={toggleMic} title="Mikrofon">
            {listening ? '⏹' : '🎙️'}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={listening ? 'Dinliyorum…' : placeholder}
          disabled={disabled}
        />
        <button className="round-btn send" onClick={() => send()} disabled={disabled}>➤</button>
      </div>
    </div>
  )
}

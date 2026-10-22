import { lazy, Suspense, useEffect, useState } from 'react'
import { content } from '../content/content'
import { getBackend } from '../backend'
import { env } from '../lib/env'
import { answerMatches } from '../lib/normalize'
import { safeStorage } from '../lib/device'
import { enterOffline, enterWorld } from '../session'
import type { Role } from '../types'
import { CakeMark, Face } from './icons'

const AvatarPreview = lazy(() => import('../world/AvatarPreview'))
const ls = safeStorage('local')

type Step = 'who' | 'questions' | 'ready'

export function Welcome() {
  const [step, setStep] = useState<Step>('who')
  const [role, setRole] = useState<Role | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [wrong, setWrong] = useState<Record<string, boolean>>({})
  const [shake, setShake] = useState(0)
  const [code, setCode] = useState('')
  const [codeRequired, setCodeRequired] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    getBackend()
      .then((b) => b.accessCodeRequired())
      .then((r) => alive && setCodeRequired(r))
      .catch(() => alive && setCodeRequired(null))
    // warm up the 3D engine while the visitor reads
    const t = window.setTimeout(() => void import('../world/World'), 1200)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [])

  const pick = (r: Role) => {
    setRole(r)
    setError(null)
    setAnswers({})
    setWrong({})
    const remembered = ls?.getItem(`olw.passed.${r}`) === '1'
    setStep(remembered && !codeRequired ? 'ready' : 'questions')
  }

  const cfg = role ? content.roles[role] : null

  const submitQuestions = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cfg) return
    const w: Record<string, boolean> = {}
    for (const q of cfg.questions) if (!answerMatches(answers[q.id] ?? '', q.acceptedAnswers)) w[q.id] = true
    if (codeRequired && !code.trim()) w.__code = true
    setWrong(w)
    if (Object.keys(w).length) {
      setShake((n) => n + 1)
      return
    }
    ls?.setItem(`olw.passed.${role}`, '1')
    setStep('ready')
  }

  const enter = async () => {
    if (!role) return
    setBusy(true)
    setError(null)
    const res = await enterWorld(role, code.trim() || undefined)
    setBusy(false)
    if (!res.ok) {
      if (res.reason === 'bad_code') {
        setStep('questions')
        setWrong({ __code: true })
        setCodeRequired(true)
      }
      setError({ message: res.message, offline: res.reason === 'network' })
    }
  }

  return (
    <main className="welcome">
      <div className="welcome-card" key={step}>
        <div className="steps" aria-hidden>
          {(['who', 'questions', 'ready'] as Step[]).map((s, i) => (
            <span key={s} className={(['who', 'questions', 'ready'] as Step[]).indexOf(step) >= i ? 'on' : ''} />
          ))}
        </div>

        {step === 'who' && (
          <>
            <CakeMark className="loader-cake" />
            <h1>{content.title}</h1>
            <p className="lead">{content.welcomeLine}</p>
            <h2>{content.whoPrompt}</h2>
            <div className="role-grid">
              {(['me', 'sweetheart'] as Role[]).map((r) => {
                const c = content.roles[r]
                return (
                  <button key={r} className="role-card" onClick={() => pick(r)} data-testid={`role-${r}`}>
                    <Face kind={c.avatar.kind} skin={c.avatar.skin} hair={c.avatar.hair} />
                    <span className="name">{c.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="mode-note">
              {env.hasSupabase ? 'Up to two people can be inside at once.' : 'Demo mode: everything stays in this browser. Open a second tab to try two players.'}
            </p>
          </>
        )}

        {step === 'questions' && cfg && (
          <form onSubmit={submitQuestions} noValidate>
            <h2>A few little questions</h2>
            <p className="hint" style={{ marginTop: '-0.4rem' }}>
              Just for fun. Hints appear if something is not quite right.
            </p>
            {error && <div className="error-box">{error.message}</div>}
            <div className={`q-list ${shake ? 'shake' : ''}`} key={shake}>
              {cfg.questions.map((q, i) => (
                <div className="field" key={q.id}>
                  <label htmlFor={q.id}>{q.prompt}</label>
                  <input
                    id={q.id}
                    className="input"
                    autoComplete="off"
                    autoFocus={i === 0}
                    placeholder={q.placeholder}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    aria-invalid={wrong[q.id] || undefined}
                  />
                  {wrong[q.id] && (
                    <span className="hint warm">
                      {!(answers[q.id] ?? '').trim() ? 'Write a little something here.' : q.hint ? `Not quite. Hint: ${q.hint}` : 'Not quite, try again.'}
                    </span>
                  )}
                </div>
              ))}
              {codeRequired !== false && (
                <div className="field">
                  <label htmlFor="access-code">{codeRequired ? 'Shared access code' : 'Shared access code (optional)'}</label>
                  <input
                    id="access-code"
                    className="input"
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="If you were given one"
                    aria-invalid={wrong.__code || undefined}
                  />
                  {wrong.__code && <span className="hint warm">That code does not seem right. Check the message it came in.</span>}
                </div>
              )}
            </div>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setStep('who')}>
                Back
              </button>
              <button type="submit" className="btn" data-testid="questions-continue">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'ready' && cfg && (
          <>
            <h2>{role === 'sweetheart' ? 'There you are.' : 'Welcome back.'}</h2>
            <div className="avatar-preview">
              <Suspense fallback={null}>
                <AvatarPreview look={cfg.avatar} />
              </Suspense>
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error.message}
              </div>
            )}
            <div className="row">
              <button className="btn ghost" onClick={() => setStep('who')} disabled={busy}>
                Back
              </button>
              <button className="btn" onClick={enter} disabled={busy} data-testid="enter">
                {busy ? 'Opening the gate…' : content.enterButton}
              </button>
            </div>
            {error?.offline && (
              <div className="row" style={{ marginTop: '0.8rem' }}>
                <button className="btn ghost small" onClick={() => role && enterOffline(role)}>
                  Explore on my own (offline, example content)
                </button>
              </div>
            )}
            <p className="mode-note">Use headphones for the full effect. You can mute sounds any time.</p>
          </>
        )}
      </div>
    </main>
  )
}

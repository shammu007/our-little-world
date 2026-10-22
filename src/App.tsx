import { lazy, Suspense, useEffect } from 'react'
import { attachKeyboard, clearInput } from './input/input'
import { isTouchDevice } from './lib/device'
import { useStore } from './state/store'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Hud } from './ui/Hud'
import { Loading } from './ui/Loading'
import { Overlays } from './ui/Overlays'
import { TouchControls } from './ui/TouchControls'
import { Welcome } from './ui/Welcome'
import { interact } from './world/actions'

const World = lazy(() => import('./world/World'))

// Small debug/test hook. Exposes only non-secret client state.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./state/store'), import('./net/room')]).then(([{ live, useStore }, { remoteBuffers }]) => {
    ;(window as unknown as { __olw: unknown }).__olw = {
      live,
      store: useStore,
      remote: () => [...remoteBuffers.values()].map((b) => b.sample(performance.now())?.p ?? null),
    }
  })
}

export default function App() {
  const phase = useStore((s) => s.phase)
  const ready = useStore((s) => s.worldReady)
  const reduced = useStore((s) => s.settings.reducedMotion)

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced)
  }, [reduced])

  // loading → playing once the first frames have rendered
  useEffect(() => {
    if (phase === 'loading' && ready) useStore.getState().setPhase('playing')
  }, [phase, ready])

  useEffect(() => {
    const detach = attachKeyboard(
        interact,
        () => {
          const s = useStore.getState()
          if (s.overlay) s.closeOverlay()
        },
        () => {
          const s = useStore.getState()
          return s.phase === 'playing' && !s.overlay && !s.superseded
        },
      )
    return () => {
      detach()
      clearInput()
    }
  }, [])

  if (phase === 'welcome') return <Welcome />
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <World />
      </Suspense>
      {phase === 'playing' && (
        <>
          {isTouchDevice() && <TouchControls />}
          <Hud />
          <Overlays />
        </>
      )}
      <Loading />
    </ErrorBoundary>
  )
}

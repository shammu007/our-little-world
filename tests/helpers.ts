import { expect, type Page } from '@playwright/test'

type Role = 'me' | 'sweetheart'

/** Low graphics keeps software-rendered WebGL fast enough for CI. */
export async function prepare(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('olw.settings')) localStorage.setItem('olw.settings', JSON.stringify({ quality: 'low', muted: true, reducedMotion: false }))
    } catch {
      /* ignore */
    }
  })
}

export async function enter(page: Page, role: Role) {
  await prepare(page)
  await page.goto('/?debug')
  await page.getByTestId(`role-${role}`).click()
  const continueBtn = page.getByTestId('questions-continue')
  if (await continueBtn.isVisible().catch(() => false)) {
    const inputs = page.locator('.q-list input')
    const n = await inputs.count()
    const answers = role === 'me' ? ['our little world', 'hers'] : ['25', 'autumn', 'tea']
    for (let i = 0; i < n; i++) await inputs.nth(i).fill(answers[i] ?? 'x')
    await continueBtn.click()
  }
  await page.getByTestId('enter').click()
  await expect(page.locator('.loading.done')).toBeAttached({ timeout: 120_000 })
}

export const state = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __olw: { store: { getState(): Record<string, unknown> }; live: Record<string, unknown> } }
    const s = w.__olw.store.getState()
    return {
      cake: s.cake as { out: boolean; rev: number },
      remotes: s.remotes as { role: string; sessionId: string }[],
      overlay: s.overlay as { type: string } | null,
      focus: s.focus as { kind: string } | null,
      superseded: s.superseded as boolean,
      letter: s.letter as { title: string } | null,
      pos: w.__olw.live.playerPos as [number, number, number],
      cam: w.__olw.live.cameraPos as [number, number, number],
      photos: (s.photos as { caption: string }[]).map((p) => p.caption),
      uploaded: (s.photos as { wall: string; placeholder?: boolean }[]).filter((p) => !p.placeholder).map((p) => p.wall),
    }
  })

export const teleport = (page: Page, x: number, z: number, yaw: number) =>
  page.evaluate(([x, z, yaw]) => {
    ;(window as unknown as { __olw: { live: { teleport: unknown } } }).__olw.live.teleport = { x, z, yaw }
  }, [x, z, yaw] as const)

export const remotePositions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __olw: { remote(): ([number, number, number] | null)[] } }).__olw.remote())

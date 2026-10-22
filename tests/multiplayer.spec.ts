import { expect, test } from '@playwright/test'
import { enter, remotePositions, state, teleport } from './helpers'

// Demo mode syncs tabs of the same browser via BroadcastChannel, using the same
// presence / broadcast / interpolation code paths as the Supabase transport.
test('two players see each other, movement and the cake stay in sync', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const a = await ctx.newPage()
  const b = await ctx.newPage()
  await enter(a, 'me')
  await enter(b, 'sweetheart')

  await expect.poll(async () => (await state(a)).remotes.map((r) => r.role)).toEqual(['sweetheart'])
  await expect.poll(async () => (await state(b)).remotes.map((r) => r.role)).toEqual(['me'])
  await expect(a.getByTestId('partner-status')).toContainText('is here')

  // B moves; A renders B near the new spot (interpolated)
  await teleport(b, 6, 10, 0)
  await expect
    .poll(async () => {
      const p = (await remotePositions(a))[0]
      return p ? Math.hypot(p[0] - 6, p[2] - 10) : 99
    }, { timeout: 30_000 })
    .toBeLessThan(0.6)

  // A blows out the candles; B sees the shared state change
  await teleport(a, 0, 3.4, Math.PI)
  await expect.poll(async () => (await state(a)).focus?.kind).toBe('cake')
  await a.keyboard.press('KeyE')
  await expect.poll(async () => (await state(b)).cake.out).toBe(true)

  // a late joiner gets the current world state
  await b.close()
  await expect.poll(async () => (await state(a)).remotes.length, { timeout: 20_000 }).toBe(0)
  const b2 = await ctx.newPage()
  await enter(b2, 'sweetheart')
  await expect.poll(async () => (await state(b2)).cake.out).toBe(true)
  await expect.poll(async () => (await state(a)).remotes.length).toBe(1)

  // opening the same role again takes over and the older tab steps aside
  const a2 = await ctx.newPage()
  await enter(a2, 'me')
  await expect.poll(async () => (await state(a)).superseded).toBe(true)
  await expect(a.getByText('You are inside somewhere else')).toBeVisible()
  await expect.poll(async () => (await state(b2)).remotes.map((r) => r.role)).toEqual(['me'])
  await ctx.close()
})

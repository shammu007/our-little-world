import { expect, test } from '@playwright/test'
import { enter, prepare, state, teleport } from './helpers'

test('welcome flow: friendly retry on a wrong answer, then enter', async ({ page }) => {
  await prepare(page)
  await page.goto('/')
  await expect(page.getByText('Who is entering our little world?')).toBeVisible()
  // no login / signup UI anywhere
  await expect(page.locator('input[type=email], input[type=password]')).toHaveCount(0)
  await page.getByTestId('role-sweetheart').click()
  const inputs = page.locator('.q-list input')
  await inputs.nth(0).fill('7')
  await inputs.nth(1).fill('spring')
  await inputs.nth(2).fill('tea')
  await page.getByTestId('questions-continue').click()
  await expect(page.getByText(/Not quite\. Hint:/)).toBeVisible()
  await inputs.nth(0).fill('Twenty-five')
  await page.getByTestId('questions-continue').click()
  await expect(page.getByTestId('enter')).toBeVisible()
  await page.getByTestId('enter').click()
  await expect(page.locator('.loading.done')).toBeAttached({ timeout: 120_000 })
  await expect(page.getByText('Sweetheart', { exact: false }).first()).toBeVisible()
})

test('movement, collisions and the camera', async ({ page }) => {
  await enter(page, 'me')
  const start = (await state(page)).pos
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyW')
  const moved = (await state(page)).pos
  expect(start[2] - moved[2]).toBeGreaterThan(1.5) // walked north toward the cake
  // walk into the hall's left wall: must stop at the wall (x = -8 + wall thickness)
  await teleport(page, -6.5, -27, -Math.PI / 2)
  await page.waitForTimeout(600)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyW')
  const atWall = (await state(page)).pos
  expect(atWall[0]).toBeGreaterThan(-7.9)
  expect(atWall[0]).toBeLessThan(-7.0)
  // camera collision: standing at the wall facing into the room, the camera
  // would be outside the house without collision. It must stay inside.
  await teleport(page, -7.3, -27, Math.PI / 2)
  await page.waitForTimeout(1500)
  const { cam, pos } = await state(page)
  expect(cam[0]).toBeGreaterThan(-7.85)
  expect(cam[1]).toBeLessThan(4.6)
  expect(Math.hypot(cam[0] - pos[0], cam[2] - pos[2])).toBeLessThan(1.5)
})

test('cake: 25 candles blow out with confetti and relight', async ({ page }) => {
  await enter(page, 'me')
  await teleport(page, 0, 3.4, Math.PI)
  await expect.poll(async () => (await state(page)).focus?.kind).toBe('cake')
  await expect(page.getByTestId('interact-prompt')).toContainText('blow out')
  await page.keyboard.press('KeyE')
  await expect.poll(async () => (await state(page)).cake.out).toBe(true)
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('interact-prompt')).toContainText('Relight')
  await page.keyboard.press('KeyE')
  await expect.poll(async () => (await state(page)).cake.out).toBe(false)
})

test('gallery: prompt near a frame opens the larger photo', async ({ page }) => {
  await enter(page, 'me')
  await teleport(page, -5.9, -24, -Math.PI / 2)
  await expect.poll(async () => (await state(page)).focus?.kind).toBe('photo')
  await expect(page.getByTestId('interact-prompt')).toContainText('Look closer')
  await page.keyboard.press('KeyE')
  const viewer = page.getByTestId('photo-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('img')).toHaveJSProperty('complete', true)
  const ratio = await viewer.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight)
  expect(ratio).toBeGreaterThan(0.3)
  await expect(viewer.locator('figcaption')).toContainText('Placeholder memory')
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
})

test('portal: clue, friendly retry, then the letter', async ({ page }) => {
  await enter(page, 'sweetheart')
  await teleport(page, 0, -31.3, Math.PI)
  await expect(page.getByTestId('portal-clue')).toBeVisible()
  expect((await state(page)).letter).toBeNull()
  await page.keyboard.press('KeyE')
  await page.getByTestId('portal-answer').fill('guitar')
  await page.getByTestId('portal-submit').click()
  await expect(page.getByText(/Not quite|Close, maybe|Hmm/)).toBeVisible()
  expect((await state(page)).letter).toBeNull()
  await page.getByTestId('portal-answer').fill('A PIANO!')
  await page.getByTestId('portal-submit').click()
  await expect(page.getByTestId('letter')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('letter')).toContainText('Dear sweetheart')
})

test('owner editor: change a caption and wall, save, and see it in the world', async ({ page }) => {
  await enter(page, 'me')
  await page.getByTestId('open-editor').click()
  const editor = page.getByTestId('editor')
  await expect(editor).toBeVisible()
  const firstCaption = editor.locator('.photo-row input').first()
  await firstCaption.fill('A brand new caption')
  await editor.locator('.photo-row select').first().selectOption('right')
  await page.getByTestId('save-photos').click()
  await expect.poll(async () => (await state(page)).photos.includes('A brand new caption')).toBe(true)
  // upload a generated image
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 300
    c.height = 200
    const g = c.getContext('2d')!
    g.fillStyle = '#c9d6b8'
    g.fillRect(0, 0, 300, 200)
    return c.toDataURL('image/png').split(',')[1]
  })
  await page.getByTestId('upload-input').setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  // it replaces the first example photo (on the main wall) and is saved straight away
  await expect.poll(async () => (await state(page)).uploaded).toEqual(['back'])
  await expect(editor.locator('.photo-row')).toHaveCount(16)
  await page.reload()
  await enter(page, 'me')
  await expect.poll(async () => (await state(page)).uploaded).toEqual(['back'])
  await expect.poll(async () => (await state(page)).photos.length).toBe(16)
})

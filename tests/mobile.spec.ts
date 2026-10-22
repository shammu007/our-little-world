import { expect, test } from '@playwright/test'
import { enter, state, teleport } from './helpers'

test('mobile: joystick walks, big button interacts', async ({ page }) => {
  await enter(page, 'sweetheart')
  await expect(page.getByTestId('touch-interact')).toBeVisible()
  const before = (await state(page)).pos
  // drag the floating joystick upward on the left side
  const layer = page.getByTestId('touch-layer')
  const box = (await layer.boundingBox())!
  const x = box.x + box.width * 0.2
  const y = box.y + box.height * 0.75
  await layer.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true })
  await layer.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y - 60, isPrimary: true })
  await page.waitForTimeout(2500)
  await layer.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y - 60, isPrimary: true })
  const after = (await state(page)).pos
  expect(before[2] - after[2]).toBeGreaterThan(1)

  await teleport(page, 0, 3.4, Math.PI)
  await expect(page.getByTestId('touch-interact')).toHaveText(/Blow/)
  await page.getByTestId('touch-interact').dispatchEvent('pointerdown', { pointerType: 'touch' })
  await expect.poll(async () => (await state(page)).cake.out).toBe(true)
})

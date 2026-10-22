// Dev helper: photographs the garden. Usage: node scripts/garden-tour.mjs <outDir> [url]
import { chromium } from '@playwright/test'

const out = process.argv[2] || '.'
const url = process.argv[3] || 'http://localhost:5173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const logs = []
page.on('console', (m) => m.type() === 'error' && logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url)
await page.getByTestId('role-me').click()
const inputs = page.locator('.q-list input')
await inputs.nth(0).fill('Our Little World!')
await page.getByTestId('questions-continue').click()
await page.getByTestId('enter').click()
await page.waitForSelector('.loading.done', { timeout: 90000, state: 'attached' })
const tp = (x, z, yaw, camYaw) => page.evaluate(([x, z, yaw, camYaw]) => (window.__olw.live.teleport = { x, z, yaw, camYaw }), [x, z, yaw, camYaw])
const shot = async (name, wait = 2500) => {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/${name}.png` })
}
await shot('g1-spawn', 5000)
await tp(1.5, 11, Math.PI)
await shot('g2-garden')
await tp(-4, 6, Math.PI * 1.15)
await shot('g3-fountain')
await tp(5, 3.5, Math.PI * 0.85)
await shot('g4-heart-tree')
await tp(0, 3.7, Math.PI)
await page.waitForTimeout(1200)
await page.keyboard.press('KeyE')
await shot('g5-cake-blown', 1500)
console.log(logs.slice(0, 20).join('\n') || 'no errors')
await browser.close()

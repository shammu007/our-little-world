// Dev helper: drives the app in headless Chromium and saves screenshots.
// Usage: node scripts/shot.mjs <outDir> [url]
import { chromium } from '@playwright/test'

const out = process.argv[2] || '.'
const url = process.argv[3] || 'http://localhost:5173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url)
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/01-welcome.png` })
await page.getByTestId('role-sweetheart').click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/02-questions.png` })
const inputs = page.locator('.q-list input')
await inputs.nth(0).fill('7')
await page.getByTestId('questions-continue').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/03-wrong.png` })
await inputs.nth(0).fill('25')
await inputs.nth(1).fill('autumn')
await inputs.nth(2).fill('tea')
await page.getByTestId('questions-continue').click()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}/04-ready.png` })
await page.getByTestId('enter').click()
await page.waitForSelector('.loading.done', { timeout: 90000, state: 'attached' })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${out}/05-spawn.png` })
console.log(logs.join('\n'))
await browser.close()

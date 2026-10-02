import { expect, test } from '@playwright/test'

for (const quality of ['performance', 'balanced', 'quality'] as const)
	for (const camera of ['orbit', 'isometric'] as const)
		test(`${quality} ${camera}: stable white balance while orbiting and panning`, async ({
			page,
		}) => {
			const errors: string[] = []
			page.on('pageerror', (error) => errors.push(error.message))
			await page.goto('/')
			await page.waitForFunction(() => 'ghostLightingHarness' in window)
			await page.evaluate((options) => window.ghostLightingHarness.load(options), {
				quality,
				camera,
				ambientProbe: true,
			})
			const colors: number[][] = []
			const reflections: number[][] = []
			for (const [azimuth, pan] of [
				[0, 0],
				[0, -9],
				[0, 9],
				[0.25, 9],
				[-0.25, -9],
				[0, 0],
			]) {
				const frame = await page.evaluate(
					([azimuth, pan]) =>
						window.ghostLightingHarness.moveCamera(azimuth ?? 0, pan ?? 0),
					[azimuth, pan],
				)
				expect(frame.exposure).toBe(1)
				colors.push(
					await page.evaluate(() => window.ghostLightingHarness.samplePoint(0, 0, 0)),
				)
				reflections.push(
					await page.evaluate(() => window.ghostLightingHarness.samplePoint(0, 0.02, 5)),
				)
			}
			for (let channel = 0; channel < 3; channel++) {
				const values = colors.map((color) => color[channel] ?? 0)
				expect(Math.min(...values)).toBeGreaterThan(20)
				expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2)
			}
			expect(
				Math.max(
					...[0, 1, 2].map((channel) => {
						const values = reflections.map((color) => color[channel] ?? 0)
						return Math.max(...values) - Math.min(...values)
					}),
				),
			).toBeGreaterThan(10)
			expect(errors).toEqual([])
		})

for (const quality of ['performance', 'balanced', 'quality'] as const)
	for (const camera of ['orbit', 'isometric'] as const) {
		test(`${quality} ${camera}: white, ice, glass, lights, night, beams and capture stability`, async ({
			page,
		}, testInfo) => {
			const errors: string[] = []
			page.on('pageerror', (error) => errors.push(error.message))
			page.on('console', (message) => {
				if (message.type() === 'error') errors.push(message.text())
			})
			await page.goto('/')
			await page.waitForFunction(() => 'ghostLightingHarness' in window)
			for (const night of [false, true]) {
				await page.evaluate((options) => window.ghostLightingHarness.load(options), {
					quality,
					camera,
					night,
					beams: true,
				})
				const first = await page.evaluate(() => window.ghostLightingHarness.render())
				for (let capture = 0; capture < 4; capture++) {
					const next = await page.evaluate(() => window.ghostLightingHarness.render())
					expect(Math.abs(next.mean - first.mean)).toBeLessThan(0.1)
					expect(next.clipped).toBeLessThan(0.05)
					expect(next.nonBlack).toBeGreaterThan(night ? 0.2 : 0.5)
					expect(next.exposure).toBe(1)
					expect(next.shadows).toBeLessThanOrEqual(
						quality === 'quality' ? 8 : quality === 'balanced' ? 2 : 0,
					)
				}
				const path = testInfo.outputPath(
					`${quality}-${camera}-${night ? 'night' : 'day'}.png`,
				)
				await page.screenshot({ path })
				await testInfo.attach(`${quality}-${camera}-${night ? 'night' : 'day'}`, {
					path,
					contentType: 'image/png',
				})
			}
			await page.evaluate(() => window.ghostLightingHarness.dispose())
			expect(errors).toEqual([])
		})
		for (const level of ['airborne-embers', 'a-colourful-valley', 'aerotaro'])
			test(`${level} ${quality} ${camera}`, async ({ page }, testInfo) => {
				const available = await (await page.request.get('/fixtures')).json()
				test.skip(
					!available.includes(level),
					'Set GHOST_LIGHTING_FIXTURES_DIR to private source exports',
				)
				const errors: string[] = []
				page.on('pageerror', (error) => errors.push(error.message))
				page.on('console', (message) => {
					if (message.type() === 'error') errors.push(message.text())
				})
				await page.goto('/')
				await page.waitForFunction(() => 'ghostLightingHarness' in window)
				await page.evaluate((options) => window.ghostLightingHarness.load(options), {
					quality,
					camera,
					level,
				})
				const first = await page.evaluate(() => window.ghostLightingHarness.render())
				const repeated = await page.evaluate(() => window.ghostLightingHarness.render())
				expect(Math.abs(first.mean - repeated.mean)).toBeLessThan(0.1)
				expect(first.clipped).toBeLessThan(0.05)
				expect(first.nonBlack).toBeGreaterThan(0.2)
				const path = testInfo.outputPath(`${level}-${quality}-${camera}.png`)
				await page.screenshot({ path })
				await testInfo.attach(`${level}-${quality}-${camera}`, {
					path,
					contentType: 'image/png',
				})
				expect(errors).toEqual([])
			})
	}

test('authored beams stop at geometry and use selected shadow maps', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => 'ghostLightingHarness' in window)
	const energy = async (beams: boolean, occluder: boolean) => {
		await page.evaluate((options) => window.ghostLightingHarness.load(options), {
			quality: 'quality' as const,
			camera: 'orbit' as const,
			night: true,
			beams,
			pointBeams: false,
			occluder,
		})
		return page.evaluate(() => window.ghostLightingHarness.beamEnergy())
	}
	const disabled = await energy(false, false)
	const open = await energy(true, false)
	const occluded = await energy(true, true)
	expect(disabled).toBe(0)
	expect(open).toBeGreaterThan(0.00001)
	expect(occluded).toBeLessThan(open * 0.99)
})

test('resize, renderer replacement and physics restoration release lighting state', async ({
	page,
}) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto('/')
	await page.waitForFunction(() => 'ghostLightingHarness' in window)
	const options = { quality: 'balanced', camera: 'isometric', beams: true } as const
	await page.evaluate((options) => window.ghostLightingHarness.load(options), options)
	const first = await page.evaluate(() => window.ghostLightingHarness.render())
	const resized = await page.evaluate(() => window.ghostLightingHarness.resize(800, 450))
	expect(resized.exposure).toBe(1)
	const replaced = await page.evaluate(
		(options) => window.ghostLightingHarness.replaceRenderer(options),
		options,
	)
	expect(Math.abs(replaced.mean - first.mean)).toBeLessThan(0.1)
	const restored = await page.evaluate(
		(options) => window.ghostLightingHarness.restoreContext(options),
		options,
	)
	expect(Math.abs(restored.mean - first.mean)).toBeLessThan(0.1)
	expect(await page.evaluate(() => window.ghostLightingHarness.physics())).toEqual({
		shadows: false,
		toneMapping: 0,
		groups: false,
	})
	expect(errors).toEqual([])
})

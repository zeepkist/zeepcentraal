import { expect, type Locator } from '@playwright/test'
import { test } from '../support/browser'

test.skip(process.env.PLAYWRIGHT_HYDRATION_RUNTIME !== 'development', 'Development fixture only')

async function expectEndpoints(axis: Locator, minimum: string, maximum: string) {
	const ticks = axis.locator('text')
	await expect(ticks.first()).toHaveText(minimum)
	await expect(ticks.last()).toHaveText(maximum)
}

async function expectEvenTicks(axis: Locator, labels: string[]) {
	const ticks = axis.locator('text')
	await expect(ticks).toHaveText(labels)
	const positions = await ticks.evaluateAll((elements) =>
		elements.map((element) => Number(element.getAttribute('y'))),
	)
	const gaps = positions
		.slice(1)
		.map((position, index) => position - (positions[index] ?? position))
	expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1)
}

test('line chart domains follow visible data and honor fixed scales', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/motion-chart-domains', { waitUntil: 'domcontentloaded' })
	const axes = (region: string) =>
		page.getByRole('region', { name: region }).locator('.v-charts-yAxis')

	await expectEndpoints(axes('Level points history'), '0', '9984')

	const career = axes('Career history')
	await expectEvenTicks(career.nth(0), ['61K', '63K', '65K', '67K', '69K'])
	await expectEvenTicks(career.nth(1), ['#21', '#11', '#1'])
	await expect(career.nth(1).getByText('#0', { exact: true })).toHaveCount(0)
	await page
		.getByRole('region', { name: 'Career history' })
		.getByRole('tab', { name: 'Total points', exact: true })
		.click()
	await expectEvenTicks(career.nth(0), ['0', '3M', '6M', '9M', '12M'])
	await page.getByRole('tab', { name: 'World records', exact: true }).click()
	await expectEvenTicks(career.nth(1), ['10', '20', '30'])

	const lobby = page.getByRole('img', { name: 'Lobby activity' }).locator('.v-charts-yAxis')
	await expectEndpoints(lobby, '4', '22')
	await page.getByRole('button', { name: 'Capacity' }).click()
	await expectEndpoints(lobby, '4', '10')
	await page.getByRole('button', { name: 'Players' }).click()
	await expect(page.getByRole('img', { name: 'Lobby activity' })).toHaveCount(0)

	const splits = axes('Split charts')
	const splitCheckpointAxes = page
		.getByRole('region', { name: 'Split charts' })
		.locator('.v-charts-xAxis')
	await expect(splitCheckpointAxes.nth(0).locator('text')).toHaveText(['CP 1', 'Finish'])
	await expect(splitCheckpointAxes.nth(1).locator('text')).toHaveText(['CP 1', 'Finish'])
	await expectEvenTicks(splits.nth(0), ['-210ms', '-70ms', '70ms', '210ms'])
	await expectEndpoints(splits.nth(1), '10', '14')
	await page.getByRole('button', { name: 'Toggle viewer comparison' }).click()
	await expectEvenTicks(splits.nth(0), ['-210ms', '-80ms', '50ms', '180ms', '310ms'])
	await expectEndpoints(splits.nth(1), '10', '20')

	const telemetry = axes('Record telemetry')
	await expectEndpoints(telemetry.nth(0), '6', '10')
	await expectEndpoints(telemetry.nth(1), 'steeringLeft', 'steeringRight')
	await expect(telemetry.nth(1).getByText('0', { exact: true })).toBeVisible()
})

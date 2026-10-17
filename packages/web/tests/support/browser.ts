import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ runtimeErrors: undefined }>({
	runtimeErrors: [
		async ({ page }, use) => {
			const errors: string[] = []
			await page.route('https://ko-fi.com/**', (route) =>
				route.fulfill({ contentType: 'text/html', body: '<p>Fixture embed</p>' }),
			)
			await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
				route.fulfill({
					contentType: 'application/javascript',
					body: "window.turnstile = { render() { return 'fixture' }, remove() {}, reset() {} }",
				}),
			)
			page.on('pageerror', (error) => errors.push(error.message))
			page.on('console', (message) => {
				if (
					/hydration.*mismatch|^(?:TypeError|ReferenceError|SyntaxError):/i.test(
						message.text(),
					)
				)
					errors.push(message.text())
			})
			await use(undefined)
			expect(errors, 'Browser runtime errors and hydration mismatches').toEqual([])
		},
		{ auto: true },
	],
})

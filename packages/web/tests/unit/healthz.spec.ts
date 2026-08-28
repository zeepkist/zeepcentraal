import { afterEach, describe, expect, test, vi } from 'vitest'

describe('health check route', () => {
	afterEach(() => vi.unstubAllGlobals())

	test.each(['get', 'head'])('serves %s requests without rendering the app', async (method) => {
		vi.stubGlobal('defineEventHandler', <T>(handler: T) => handler)
		const handler = (await import(`../../server/routes/healthz.${method}.ts`))
			.default as () => string

		expect(handler()).toBe('OK')
	})
})

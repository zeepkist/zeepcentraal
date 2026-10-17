import { describe, expect, test } from 'vitest'

describe('health check route', () => {
	test.each(['get', 'head'])('serves %s requests without rendering the app', async (method) => {
		const handler = (await import(`../../server/routes/healthz.${method}.ts`))
			.default as () => string

		expect(handler()).toBe('OK')
	})
})

import { expect, test } from 'bun:test'

test('Discord entrypoint is import-safe', async () => {
	expect(await import('./index')).toBeDefined()
})

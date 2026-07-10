import { expect, test } from 'bun:test'

test('unit tests block unmocked external fetch', async () => {
	await expect(fetch('https://example.com')).rejects.toThrow(
		'Unexpected external fetch in unit test: https://example.com',
	)
})

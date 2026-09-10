import { expect, test } from 'bun:test'
import { configSchema, parseOptions, rulesSchema } from '.'

test('explicit bounded rules and CLI options', () => {
	expect(parseOptions(['--force', '--dry-run'])).toEqual({ force: true, dryRun: true })
	expect(() => parseOptions(['--unknown'])).toThrow()
	expect(() =>
		rulesSchema.parse({
			minBlocks: 10,
			maxBlocks: 1,
			minTime: 25,
			maxTime: 60,
			minCheckpoints: 3,
		}),
	).toThrow()
	expect(() =>
		configSchema.parse({ version: 1, forums: [], seasons: {}, contests: [] }),
	).toThrow()
})

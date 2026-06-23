import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCsvLevel, parseJsonLevel, parseLevel } from '.'

const csv = [
	'LevelEditor2,Author,uid-1',
	'0,0,0,0,0,0,0,0',
	'12.5,20,25,30,1,-1',
	'22,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
	'2,1,2,3,4,5,6,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
].join('\n')

describe('legacy level parsing', () => {
	test('parses CSV metadata and adventure UID hash', () => {
		const parsed = parseCsvLevel(csv, true, 76561198000000000n)
		expect(parsed.hash).toBe('uid-1')
		expect(parsed.authorId).toBe(76561198000000000n)
		expect(parsed.amountCheckpoints).toBe(1)
		expect(parsed.amountFinishes).toBe(1)
		expect(parsed.amountBlocks).toBe(2)
		expect(parsed.typeGround).toBe(-1)
		expect(parsed.typeSkybox).toBe(1)
	})

	test('parses JSON metadata and preserves blocks', () => {
		const blocks = [
			{ i: 1609, u: 'a', p: {}, r: {}, s: {}, d: { n: { ch5: 1 } } },
			{ i: 1616, u: 'b', p: {}, r: {}, s: {} },
		]
		const parsed = parseJsonLevel(
			JSON.stringify({
				level: { UID: 'uid-json', zeepHash: 'legacy-json-hash' },
				author: { name: 'Author', StmID: '76561198000000000' },
				medals: { author: 10, gold: 11, silver: 12, bronze: 13 },
				enviro: { skybox: 2, groundMat: -1 },
				blox: blocks,
			}),
		)
		expect(parsed.hash).toBe('legacy-json-hash')
		expect(parsed.authorId).toBe(76561198000000000n)
		expect(parsed.amountCheckpoints).toBe(1)
		expect(parsed.amountFinishes).toBe(1)
		expect(parsed.blocks).toEqual(blocks)
	})

	test('parses JSON with UTF-8 BOM', () => {
		const parsed = parseLevel(
			`\uFEFF${JSON.stringify({
				level: { UID: 'uid-bom', zeepHash: 'hash-bom' },
				author: { name: 'Author', StmID: '1' },
				medals: { author: 1, gold: 2, silver: 3, bronze: 4 },
				enviro: { skybox: 1, groundMat: -1 },
				blox: [],
			})}`,
		)
		expect(parsed.hash).toBe('hash-bom')
	})

	test('rejects malformed CSV blocks', () => {
		expect(() => parseCsvLevel(`${csv}\n1,2,3`)).toThrow('expected 38')
	})

	test('matches ZeepSDK legacy hash vectors', () => {
		const fixtureDirectory = join(import.meta.dir, '../../testdata/legacy-hash')
		const vectors = readFileSync(join(fixtureDirectory, 'vectors.csv'), 'utf8')
			.trim()
			.split(/\r?\n/)
			.slice(1)

		for (const vector of vectors) {
			const [fileName, expectedSha1, expectedSha256] = vector.split(',')
			if (!fileName || !expectedSha1 || !expectedSha256) {
				throw new Error(`Invalid compatibility vector: ${vector}`)
			}
			const bytes = readFileSync(join(fixtureDirectory, fileName))
			expect(createHash('sha256').update(bytes).digest('hex').toUpperCase()).toBe(
				expectedSha256,
			)
			expect(parseCsvLevel(bytes.toString('utf8')).hash).toBe(expectedSha1)
		}
	})
})

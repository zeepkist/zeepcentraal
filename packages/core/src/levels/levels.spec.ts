import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCsvLevel, parseJsonLevel, parseJsonLevelV2, parseLevel, parseLevelV2 } from '.'

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

	test('normalizes invalid validation medal times to zero', () => {
		const parsedCsv = parseCsvLevel(
			['LevelEditor2,Author,uid-1', '0,0,0,0,0,0,0,0', 'NaN,Infinity,NaN,Infinity,1,-1'].join(
				'\n',
			),
		)

		expect(parsedCsv.validationTimeAuthor).toBe(0)
		expect(parsedCsv.validationTimeGold).toBe(0)
		expect(parsedCsv.validationTimeSilver).toBe(0)
		expect(parsedCsv.validationTimeBronze).toBe(0)

		const parsedJson = parseJsonLevel(
			JSON.stringify({
				level: { UID: 'uid-json', zeepHash: 'legacy-json-hash' },
				author: { name: 'Author', StmID: '76561198000000000' },
				medals: { author: 'NaN', gold: 'Infinity', silver: null, bronze: undefined },
				enviro: { skybox: 2, groundMat: -1 },
				blox: [],
			}),
		)

		expect(parsedJson.validationTimeAuthor).toBe(0)
		expect(parsedJson.validationTimeGold).toBe(0)
		expect(parsedJson.validationTimeSilver).toBe(0)
		expect(parsedJson.validationTimeBronze).toBe(0)
	})

	test('allows CSV blocks with invalid column counts', () => {
		const parsedShort = parseCsvLevel(`${csv}\n1,2,3`)
		expect(parsedShort.amountBlocks).toBe(3)
		expect(parsedShort.blocks.at(-1)).toMatchObject({
			Id: 1,
			Position: { X: 2, Y: 3, Z: 0 },
		})

		const parsedLong = parseCsvLevel(
			`${csv}\n${Array.from({ length: 40 }, (_, index) => index).join(',')}`,
		)
		expect(parsedLong.amountBlocks).toBe(3)
		expect(
			(parsedLong.blocks.at(-1) as { Options: number[] } | undefined)?.Options,
		).toHaveLength(13)
	})

	test('matches ZeepSDK legacy hash vectors', () => {
		const fixtureDirectory = join(import.meta.dir, '../../testdata/legacy-hash')
		const vectors = readFileSync(join(fixtureDirectory, 'vectors.csv'), 'utf8')
			.trim()
			.split(/\r?\n/)
			.slice(1)

		for (const vector of vectors) {
			const [fileName, format, expectedZeepHash, expectedSha256, expectedXxh128] =
				vector.split(',')
			if (!fileName || !format || !expectedZeepHash || !expectedSha256 || !expectedXxh128) {
				throw new Error(`Invalid compatibility vector: ${vector}`)
			}
			const bytes = readFileSync(join(fixtureDirectory, fileName))
			expect(createHash('sha256').update(bytes).digest('hex').toUpperCase()).toBe(
				expectedSha256,
			)
			const parsed = parseLevelV2(bytes.toString('utf8'))
			expect(parsed.format === 0 ? 'csv' : 'json').toBe(format)
			expect(parsed.zeepHash).toBe(expectedZeepHash)
			expect(parsed.hash).toBe(expectedXxh128)
		}
	})

	test('treats JSON zeepHash as untrusted for XXH128', () => {
		const content = JSON.stringify({
			level: { UID: 'uid-json', zeepHash: 'legacy-json-hash' },
			author: { name: 'Author', StmID: '76561198000000000' },
			medals: { author: 10, gold: 11, silver: 12, bronze: 13 },
			enviro: { skybox: 2, groundMat: -1 },
			blox: [{ z: 1, i: 1609, d: { n: { ch5: 1 } } }],
		})
		const changedZeepHash = content.replace('legacy-json-hash', 'edited-json-hash')
		const changedBlock = content.replace('"z":1', '"z":2')

		expect(parseJsonLevelV2(changedZeepHash).hash).toBe(parseJsonLevelV2(content).hash)
		expect(parseJsonLevelV2(changedBlock).hash).not.toBe(parseJsonLevelV2(content).hash)
	})

	test('normalizes JSON object key order for XXH128', () => {
		const base = {
			level: { UID: 'uid-json', zeepHash: 'legacy-json-hash' },
			author: { name: 'Author', StmID: '76561198000000000' },
			medals: { author: 10, gold: 11, silver: 12, bronze: 13 },
			enviro: { skybox: 2, groundMat: -1 },
			blox: [{ z: 1, i: 1609, d: { n: { ch5: 1 } } }],
		}
		const reordered = {
			...base,
			blox: [{ d: { n: { ch5: 1 } }, i: 1609, z: 1 }],
		}

		expect(parseJsonLevelV2(JSON.stringify(reordered)).hash).toBe(
			parseJsonLevelV2(JSON.stringify(base)).hash,
		)
	})
})

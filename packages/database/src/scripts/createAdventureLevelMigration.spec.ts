import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	type AdventureMigrationRow,
	generateAdventureMigrationSql,
	getAdventureImageUrl,
	getAdventureSeries,
	getAdventureShortName,
	loadAdventureMigrationRows,
	parseAdventureMap,
} from './createAdventureLevelMigration'

const baseRow: AdventureMigrationRow = {
	uid: 'ea1',
	xxHash: '0123456789ABCDEF0123456789ABCDEF',
	series: 'A',
	name: "A-'01",
	imageUrl: "assets/thumbnails/1/levels/A/A-'01.avif",
	validationTimeAuthor: 1.2,
	validationTimeGold: 2.3,
	validationTimeSilver: 3.4,
	validationTimeBronze: 4.5,
	amountCheckpoints: 6,
	amountFinishes: 1,
	amountBlocks: 10,
	typeGround: 90,
	typeSkybox: 3,
	format: 1,
	blocks: [{ i: 1, name: "quoted ' block" }],
}

test('parses adventure map rows', () => {
	expect(parseAdventureMap('Hash,Level Name\nea1,Level A-01\n')).toEqual([
		{ uid: 'ea1', levelName: 'Level A-01' },
	])
})

test('resolves series, short name, and image url', () => {
	const name = getAdventureShortName('Level XG-04')
	expect(name).toBe('XG-04')
	expect(getAdventureSeries('Level XG-04')).toBe('XG')
	expect(getAdventureImageUrl('XG', name)).toBe('assets/thumbnails/1/levels/XG/XG-04.avif')
})

test('generated SQL escapes strings and filters missing xx_hash at execution time', () => {
	const sql = generateAdventureMigrationSql([baseRow])

	expect(sql).toContain(`'A-''01'`)
	expect(sql).toContain(`"level"."xx_hash" IS NULL`)
	expect(sql).toContain(`-1::bigint`)
	expect(sql).toContain(`"quoted '' block"`)
})

test('loads mapped adventure levels from files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'adventure-levels-'))
	await mkdir(join(root, 'A'))
	await writeFile(join(root, 'map.csv'), 'Hash,Level Name\nea1,Level A-01\n')
	await writeFile(
		join(root, 'A', 'Level A-01.zeeplevel'),
		JSON.stringify({
			jsonVersion: 3,
			level: { UID: 'ignored-json-uid', zeepHash: 'untrusted' },
			author: { name: 'Yannic', StmID: 0 },
			medals: { author: 1, gold: 2, silver: 3, bronze: 4 },
			enviro: { skybox: 3, groundMat: 90 },
			blox: [{ i: 1, d: { n: { ch5: 1 } } }, { i: 127 }],
		}),
	)

	const rows = await loadAdventureMigrationRows(root)

	expect(rows).toHaveLength(1)
	expect(rows[0]?.uid).toBe('ea1')
	expect(rows[0]?.name).toBe('A-01')
	expect(rows[0]?.imageUrl).toBe('assets/thumbnails/1/levels/A/A-01.avif')
	expect(rows[0]?.xxHash).toMatch(/^[0-9A-F]{32}$/)
})

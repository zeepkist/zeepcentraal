import { expect, test } from 'bun:test'
import { rulesSchema } from '../config'
import { inspectLevel } from './validate'

const rules = rulesSchema.parse({
	minBlocks: 0,
	maxBlocks: 3000,
	minTime: 25,
	maxTime: 60,
	minCheckpoints: 3,
})
const level = () => ({
	jsonVersion: 15,
	level: { UID: 'fixture', name: 'Fixture' },
	author: { name: 'Author', StmID: '76561198000000000' },
	medals: { author: 40, gold: 45, silver: 50, bronze: 60 },
	blox: [0, 1, 2].map((x) => ({
		i: 22,
		p: { x, y: 0, z: 0 },
		r: { x: 0, y: 0, z: 0 },
		s: { x: 1, y: 1, z: 1 },
		d: { n: {} },
	})),
})
test('legacy CSV framing validates before permissive core normalization', () => {
	const block = [22, 0, 0, 0, 0, 0, 0, 1, 1, 1, ...Array(28).fill(0)].join(',')
	const content = ['Level,Author,fixture', '0,0,0,0,0,0,0,0', '40,45,50,60,0,0', block].join(
		'\r\n',
	)
	expect(inspectLevel(content, 'Legacy', { ...rules, minCheckpoints: 0 }).failures).toEqual([])
	for (const invalid of ['NaN', 'Infinity', '1e999999', '1e-999999', 'garbage']) {
		expect(() =>
			inspectLevel(content.replace('40,45', `${invalid},45`), 'Legacy', rules),
		).toThrow('malformed-level')
	}
})
test('valid JSON produces verified payload and bounded measurements', () => {
	const result = inspectLevel(JSON.stringify(level()), 'Fixture', rules)
	expect(result.failures).toEqual([])
	expect(result.payload.uid).toBe('fixture')
	expect(result.payload.byteSize).toBe(result.data.length)
	expect(result.measurements.checkpoints).toBe(3)
})
test('numeric rules, modes, fixed points and center span fail explicitly', () => {
	const input = level()
	input.medals.author = 61
	const result = inspectLevel(JSON.stringify(input), 'Fixture', {
		...rules,
		maxBlocks: 2,
		requiredModes: ['Paraglider'],
		maxCenterSpan: 1,
		fixedCheckpoints: [{ id: 22, position: [99, 0, 0], tolerance: 0.01 }],
	})
	expect(result.failures).toEqual([
		'block-limit',
		'maximum-time',
		'missing-mode:Paraglider',
		'center-span',
		'missing-fixed-checkpoint:22',
	])
})
test('rejects malformed/non-finite source values rather than normalizing them into valid submissions', () => {
	expect(() => inspectLevel('{"blox":[],"medals":{"author":Infinity}}', 'bad', rules)).toThrow()
	const input = level()
	input.blox[0]!.p.x = NaN
	expect(() => inspectLevel(JSON.stringify(input), 'bad', rules)).toThrow()
})

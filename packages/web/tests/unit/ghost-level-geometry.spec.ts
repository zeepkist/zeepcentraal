import { describe, expect, it } from 'vitest'
import { parseLevelGeometryBlocks } from '../../app/utils/ghostLevelGeometry'

describe('parseLevelGeometryBlocks', () => {
	it('maps CSV level metadata vectors', () => {
		expect(
			parseLevelGeometryBlocks([
				{
					Id: 42,
					Position: { X: 16, Y: 2, Z: -8 },
					Euler: { X: 0, Y: 90, Z: 0 },
					Scale: { X: 2, Y: 1, Z: 4 },
				},
			]),
		).toEqual([
			{
				id: 42,
				attributes: {},
				paints: {},
				meshVariant: 0,
				hideLogicBlock: false,
				hideTrigger: false,
				position: { x: 16, y: 2, z: -8 },
				rotation: { x: 0, y: 90, z: 0 },
				scale: { x: 2, y: 1, z: 4 },
			},
		])
	})

	it('maps compact JSON level metadata and rejects malformed entries', () => {
		expect(
			parseLevelGeometryBlocks([
				{ i: 7, p: [1, 2, 3], r: [4, 5, 6], s: [0.5, 1, 2] },
				{ i: 8 },
			]),
		).toEqual([
			{
				id: 7,
				attributes: {},
				paints: {},
				meshVariant: 0,
				hideLogicBlock: false,
				hideTrigger: false,
				position: { x: 1, y: 2, z: 3 },
				rotation: { x: 4, y: 5, z: 6 },
				scale: { x: 0.5, y: 1, z: 2 },
			},
		])
	})

	it('decodes compact level metadata returned as JSON text', () => {
		expect(
			parseLevelGeometryBlocks(
				JSON.stringify([
					{
						i: 1490,
						p: { x: -7.07493, y: 41.3419876, z: 2.953003 },
						r: { x: 9.04873, y: 357.9862, z: 356.081665 },
						s: { x: 1, y: 1, z: 1 },
					},
				]),
			),
		).toEqual([
			{
				id: 1490,
				attributes: {},
				paints: {},
				meshVariant: 0,
				hideLogicBlock: false,
				hideTrigger: false,
				position: { x: -7.07493, y: 41.3419876, z: 2.953003 },
				rotation: { x: 9.04873, y: 357.9862, z: 356.081665 },
				scale: { x: 1, y: 1, z: 1 },
			},
		])
	})

	it('keeps CSV paint and toggle indices and accepts nonzero fractional toggles', () => {
		expect(
			parseLevelGeometryBlocks([
				{
					Id: 0,
					Position: [0, 0, 0],
					Options: [1, 0, -0.5, Infinity],
					Paints: [403, 285, 1.5],
				},
			])[0],
		).toMatchObject({
			attributes: { 0: 1, 1: 0, 2: -0.5 },
			paints: { 0: 403, 1: 285 },
		})
	})

	it('parses named integer options and rejects malformed values', () => {
		expect(
			parseLevelGeometryBlocks([
				{ i: 2445, p: [0, 0, 0], d: { n: { vr: 7, lbhd: -1, xt1: 2 } } },
			])[0],
		).toMatchObject({
			meshVariant: 7,
			hideLogicBlock: true,
			hideTrigger: true,
		})
		expect(
			parseLevelGeometryBlocks([
				{ i: 2445, p: [0, 0, 0], d: { n: { vr: 1.5, lbhd: 'bad', xt1: NaN } } },
			])[0],
		).toMatchObject({
			meshVariant: 0,
			hideLogicBlock: false,
			hideTrigger: false,
		})
	})

	it('maps validated numeric block attributes and paints', () => {
		expect(
			parseLevelGeometryBlocks([
				{
					i: 98,
					p: { x: 0, y: 0, z: 0 },
					d: {
						n: {
							a0: 1,
							a2: 0,
							p0: 403,
							p1: 285,
							a256: 1,
							p2: 1.5,
							x0: 1,
						},
						f: { a1: 1 },
						t: { p2: 'red' },
					},
				},
			]),
		).toMatchObject([
			{
				attributes: { 0: 1, 2: 0 },
				paints: { 0: 403, 1: 285 },
			},
		])
	})

	it('rejects malformed JSON text', () => {
		expect(parseLevelGeometryBlocks('[not-json')).toEqual([])
	})
})

// Validation rules adapted from Inspector Zeep, Copyright (c) 2023 James Harris (MIT).
import { createHash } from 'node:crypto'
import { type CsvBlock, levelFormat, parseLevelV2 } from '@zeepkist/core/levels'
import { decodeZeepkistLevelPayload, encodeZeepkistLevelPayload } from '@zeepkist/core/zeepnet'
import type { Rules } from '../config'

export const VALIDATOR_VERSION = '1'
const modes: Record<string, readonly number[]> = {
	'Invert Steering': [1978, 1979, 1990],
	'Invert Arms Up Braking': [1980, 1981, 1991],
	'Offroad Wheels': [1982, 1983, 1992],
	Paraglider: [1984, 1985, 1993],
	'Soap Wheels': [1608, 1610, 1987],
	'First Person': [72, 1611, 1613, 1988],
	'Third Person': [73, 1612, 1614, 1989],
	Logic: [1727, 1728, 1729, 1730, 1744, 2285, 2286],
	Music: [2279, 2280],
	Reset: [1607, 1609, 1986],
}
export const sha256 = (value: string | Uint8Array) =>
	createHash('sha256').update(value).digest('hex')
interface Block {
	id: number
	position: number[]
}
function finiteTree(value: unknown): boolean {
	if (typeof value === 'number') return Number.isFinite(value)
	if (Array.isArray(value)) return value.every(finiteTree)
	if (value && typeof value === 'object') return Object.values(value).every(finiteTree)
	return true
}
export function inspectLevel(content: string, name: string, rules: Rules) {
	const json = content
		.replace(/^\uFEFF/, '')
		.trimStart()
		.startsWith('{')
	const raw = json ? JSON.parse(content.replace(/^\uFEFF/, '')) : undefined
	if (!json) {
		const lines = content.split(/\r?\n/)
		if (lines.length < 3 || (lines[0]?.split(',').length ?? 0) < 3)
			throw new Error('malformed-level')
		// Core's compatibility parser defaults malformed numeric fields to zero.
		// Validate source fields first so corrupt submissions cannot pass rules.
		for (const line of lines.slice(1)) {
			if (!line.trim()) continue
			for (const field of line.split(',')) {
				const value = field.trim()
				if (
					!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value) ||
					!Number.isFinite(Math.fround(Number(value))) ||
					Math.abs(Number(value.match(/[eE]([-+]?\d+)$/)?.[1] ?? 0)) > 308
				)
					throw new Error('malformed-level')
			}
		}
	}
	if (
		raw &&
		(!Array.isArray(raw.blox) || !finiteTree(raw) || typeof raw.medals?.author !== 'number')
	)
		throw new Error('malformed-level')
	const parsed = parseLevelV2(content)
	if (!finiteTree(parsed.blocks)) throw new Error('malformed-level')
	for (const value of [
		parsed.uid,
		name,
		parsed.fileAuthor,
		raw?.author?.collaborators ?? '',
		raw?.author?.nameOverride ?? '',
	]) {
		if (typeof value !== 'string' || new TextEncoder().encode(value).byteLength > 4096)
			throw new Error('malformed-level')
	}
	if (
		!parsed.uid ||
		!Number.isFinite(parsed.validationTimeAuthor) ||
		parsed.validationTimeAuthor < 0
	)
		throw new Error('malformed-level')
	const blocks: Block[] =
		parsed.format === levelFormat.csv
			? (parsed.blocks as CsvBlock[]).map((b) => ({
					id: b.Id,
					position: [b.Position.X, b.Position.Y, b.Position.Z],
				}))
			: (
					raw.blox as {
						i: number
						p: { x: number; y: number; z: number }
						s: unknown
						r: unknown
					}[]
				).map((b) => ({
					id: b.i,
					position: [b.p?.x, b.p?.y, b.p?.z],
				}))
	if (blocks.some((b) => !Number.isInteger(b.id) || b.position.some((v) => !Number.isFinite(v))))
		throw new Error('malformed-level')
	const foundModes = Object.entries(modes)
		.filter(([, ids]) => blocks.some((b) => ids.includes(b.id)))
		.map(([mode]) => mode)
	const spans = [0, 1, 2].map((axis) => {
		let min = Infinity
		let max = -Infinity
		for (const block of blocks) {
			min = Math.min(min, block.position[axis]!)
			max = Math.max(max, block.position[axis]!)
		}
		return blocks.length ? max - min : 0
	})
	const failures: string[] = []
	if (blocks.length < rules.minBlocks || blocks.length > rules.maxBlocks)
		failures.push('block-limit')
	if (parsed.validationTimeAuthor < rules.minTime) failures.push('minimum-time')
	if (parsed.validationTimeAuthor > rules.maxTime) failures.push('maximum-time')
	if (parsed.amountCheckpoints < rules.minCheckpoints) failures.push('minimum-checkpoints')
	for (const mode of rules.requiredModes)
		if (!foundModes.includes(mode)) failures.push(`missing-mode:${mode}`)
	if (rules.maxCenterSpan && spans.some((s) => s > rules.maxCenterSpan!))
		failures.push('center-span')
	for (const expected of rules.fixedCheckpoints) {
		if (
			!blocks.some(
				(b) =>
					b.id === expected.id &&
					b.position.every(
						(v, axis) => Math.abs(v - expected.position[axis]!) <= expected.tolerance,
					),
			)
		)
			failures.push(`missing-fixed-checkpoint:${expected.id}`)
	}
	const payload = encodeZeepkistLevelPayload(content, json)
	decodeZeepkistLevelPayload(payload)
	return {
		failures,
		measurements: {
			blocks: blocks.length,
			checkpoints: parsed.amountCheckpoints,
			authorTime: parsed.validationTimeAuthor,
			modes: foundModes,
			centerSpan: spans,
		},
		contentSha256: sha256(content),
		data: payload,
		payload: {
			sha256: sha256(payload),
			byteSize: payload.length,
			uid: parsed.uid,
			name,
			author: parsed.fileAuthor,
			collaborators: String(raw?.author?.collaborators ?? ''),
			overrideAuthorName: String(raw?.author?.nameOverride ?? ''),
		},
	}
}

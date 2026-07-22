import { describe, expect, test } from 'bun:test'
import {
	type CompatibleTaskIdentifier,
	compatibleTaskIdentifiers,
	isValidTaskPayload,
} from '@zeepkist/jobs/task-definitions'
import { collectJobOptions, jobChoices, jobPromptDefinitions } from './jobs'
import type {
	ConfirmPromptOptions,
	PromptAdapter,
	SelectPromptOptions,
	TextPromptOptions,
} from './prompts'

class ScriptedPromptAdapter implements PromptAdapter {
	readonly #selections: unknown[]
	readonly #confirmations: boolean[]
	readonly #texts: string[]

	constructor(options: {
		selections?: unknown[]
		confirmations?: boolean[]
		texts?: string[]
	}) {
		this.#selections = [...(options.selections ?? [])]
		this.#confirmations = [...(options.confirmations ?? [])]
		this.#texts = [...(options.texts ?? [])]
	}

	async select<Value extends string | number | boolean>(
		_options: SelectPromptOptions<Value>,
	): Promise<Value> {
		return this.#take(this.#selections, 'selection') as Value
	}

	async confirm(_options: ConfirmPromptOptions): Promise<boolean> {
		return this.#take(this.#confirmations, 'confirmation')
	}

	async text(_options: TextPromptOptions): Promise<string> {
		return this.#take(this.#texts, 'text')
	}

	assertConsumed(): void {
		expect(this.#selections).toEqual([])
		expect(this.#confirmations).toEqual([])
		expect(this.#texts).toEqual([])
	}

	#take<Value>(values: Value[], kind: string): Value {
		const value = values.shift()
		if (value === undefined) {
			throw new Error(`Missing scripted ${kind}`)
		}
		return value
	}
}

async function collect(
	task: CompatibleTaskIdentifier,
	input: ConstructorParameters<typeof ScriptedPromptAdapter>[0] = {},
): Promise<Record<string, unknown>> {
	const prompt = new ScriptedPromptAdapter(input)
	const options = await collectJobOptions(prompt, task)
	prompt.assertConsumed()
	return options
}

test('prompt map exactly covers API-compatible jobs', () => {
	expect(Object.keys(jobPromptDefinitions).sort()).toEqual([...compatibleTaskIdentifiers].sort())
	expect(Object.keys(jobPromptDefinitions)).not.toContain('updateLevelScoresBatch')
	expect(jobChoices).toHaveLength(14)
})

test('choices expose category and advanced labels', () => {
	for (const choice of jobChoices) {
		expect(choice.label).toMatch(/^(Ghosts|Workshop|Scoring|History) · /)
	}

	const batchChoices = jobChoices.filter((choice) => choice.value.endsWith('Batch'))
	expect(batchChoices).toHaveLength(4)
	for (const choice of batchChoices) {
		expect(choice.hint).toStartWith('Advanced · ')
	}
})

describe('job option collection', () => {
	test('builds schema-valid payloads for all compatible jobs', async () => {
		const cases: Array<
			readonly [
				CompatibleTaskIdentifier,
				ConstructorParameters<typeof ScriptedPromptAdapter>[0],
			]
		> = [
			['backfillRecordGhostStatistics', { selections: ['incomplete'], texts: ['500'] }],
			['backfillRecordGhostStatisticsBatch', { texts: ['1, 2'] }],
			['scanWorkshopItem', { texts: ['3749321871'] }],
			['scanWorkshopBatch', { texts: ['3006532933 3749321871'], confirmations: [false] }],
			['syncWorkshopCatalog', { selections: ['stale'] }],
			['syncPersonalBests', {}],
			['updateLevelScore', { texts: ['12'], confirmations: [false, false] }],
			['updateLevelScores', { confirmations: [false, false] }],
			['updatePlayerScore', { texts: ['34'] }],
			['updatePlayerScores', {}],
			['updateLevelPointsHistory', {}],
			['updateLevelPointsHistoryBatch', { selections: ['range'], texts: ['0', '200'] }],
			['updateUserPointsHistory', {}],
			['updateUserPointsHistoryBatch', { selections: ['ids'], texts: ['5 6'] }],
		]

		for (const [task, input] of cases) {
			const options = await collect(task, input)
			expect(isValidTaskPayload(task, options), `${task} payload`).toBe(true)
		}
	})

	test('supports targeted and incomplete ghost backfills', async () => {
		expect(
			await collect('backfillRecordGhostStatistics', {
				selections: ['ids'],
				texts: ['3, 1\n3 2'],
			}),
		).toEqual({ ids: [3, 1, 2] })
		expect(
			await collect('backfillRecordGhostStatistics', {
				selections: ['incomplete'],
				texts: ['250'],
			}),
		).toEqual({ limit: 250 })
		expect(
			await collect('backfillRecordGhostStatistics', {
				selections: ['v5'],
				texts: ['500'],
			}),
		).toEqual({ limit: 500, reparseGhostVersion: 5 })
	})

	test('enforces ghost and Workshop API limits during collection', async () => {
		await expect(
			collect('backfillRecordGhostStatistics', {
				selections: ['incomplete'],
				texts: ['501'],
			}),
		).rejects.toThrow('at most 500')
		await expect(
			collect('backfillRecordGhostStatisticsBatch', {
				texts: [Array.from({ length: 501 }, (_, index) => `${index + 1}`).join(' ')],
			}),
		).rejects.toThrow('at most 500')
		await expect(
			collect('scanWorkshopBatch', {
				texts: [Array.from({ length: 11 }, (_, index) => `${index + 1}`).join(' ')],
				confirmations: [false],
			}),
		).rejects.toThrow('at most 10')
	})

	test('collects stale, full, and ZSL repair Workshop scopes', async () => {
		expect(await collect('syncWorkshopCatalog', { selections: ['stale'] })).toEqual({})
		expect(
			await collect('syncWorkshopCatalog', {
				selections: ['all'],
				confirmations: [false],
			}),
		).toEqual({
			all: true,
		})
		expect(
			await collect('syncWorkshopCatalog', {
				selections: ['all'],
				confirmations: [true],
			}),
		).toEqual({
			all: true,
			fixZeepSDKExponentHashes: true,
		})
		expect(await collect('syncWorkshopCatalog', { selections: ['repair-zsl'] })).toEqual({
			repairZslAuthors: true,
		})
	})

	test('collects Workshop batches without converting IDs to numbers', async () => {
		expect(
			await collect('scanWorkshopBatch', {
				texts: ['18446744073709551615, 42, 42'],
				confirmations: [true],
			}),
		).toEqual({
			workshopIds: ['18446744073709551615', '42'],
			fixZeepSDKExponentHashes: true,
		})
	})

	test('collects single-level optional user and report-only fields', async () => {
		expect(
			await collect('updateLevelScore', {
				texts: ['12', '34'],
				confirmations: [true, true],
			}),
		).toEqual({ idLevel: 12, idUser: 34, reportOnly: true })
		expect(
			await collect('updateLevelScores', {
				confirmations: [false, false],
			}),
		).toEqual({})
		expect(
			await collect('updateLevelScores', {
				confirmations: [true, true],
			}),
		).toEqual({ all: true, reportOnly: true })
	})

	test('collects both history batch modes with range defaults represented explicitly', async () => {
		expect(
			await collect('updateLevelPointsHistoryBatch', {
				selections: ['ids'],
				texts: ['9, 10'],
			}),
		).toEqual({ ids: [9, 10] })
		expect(
			await collect('updateUserPointsHistoryBatch', {
				selections: ['range'],
				texts: ['0', '200'],
			}),
		).toEqual({ offset: 0, limit: 200 })
	})
})

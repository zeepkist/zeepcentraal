import { expect, test } from 'bun:test'
import { runWithConcurrency } from './runWithConcurrency'

async function flushTasks() {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

test('starts next work item when either worker becomes available', async () => {
	const started: number[] = []
	const releases = new Map<number, () => void>()
	let active = 0
	let maximumActive = 0

	const running = runWithConcurrency([0, 1, 2, 3], 2, async (item) => {
		started.push(item)
		active++
		maximumActive = Math.max(maximumActive, active)
		await new Promise<void>((resolve) => releases.set(item, resolve))
		active--
	})
	await flushTasks()
	expect(started).toEqual([0, 1])

	releases.get(0)?.()
	await flushTasks()
	expect(started).toEqual([0, 1, 2])

	releases.get(2)?.()
	await flushTasks()
	expect(started).toEqual([0, 1, 2, 3])
	expect(active).toBe(2)

	releases.get(1)?.()
	releases.get(3)?.()
	await running
	expect(maximumActive).toBe(2)
})

test('stops scheduling after failure and waits for in-flight work', async () => {
	const started: number[] = []
	let releaseSecond: (() => void) | undefined
	const failure = new Error('batch failed')
	const running = runWithConcurrency([0, 1, 2], 2, async (item) => {
		started.push(item)
		if (item === 0) throw failure
		await new Promise<void>((resolve) => {
			releaseSecond = resolve
		})
	})
	await flushTasks()
	expect(started).toEqual([0, 1])

	releaseSecond?.()
	await expect(running).rejects.toBe(failure)
	expect(started).toEqual([0, 1])
})

test('rejects invalid concurrency', async () => {
	await expect(runWithConcurrency([1], 0, async () => {})).rejects.toThrow(
		'Concurrency must be a positive integer.',
	)
})

import { expect, test } from 'bun:test'
import { RecordWorkCapacityError, RecordWorkManager } from './recordWork'

test('allows one parser and four waiters, then rejects admission', async () => {
	const manager = new RecordWorkManager()
	let release: (() => void) | undefined
	const blocker = new Promise<void>((resolve) => (release = resolve))
	const work = [manager.runParser(() => blocker)]
	for (let index = 0; index < 4; index++) work.push(manager.runParser(async () => {}))
	await expect(manager.runParser(async () => {})).rejects.toBeInstanceOf(RecordWorkCapacityError)
	release?.()
	await Promise.all(work)
})

test('bounds retained upload bytes and releases unscheduled reservations', () => {
	const manager = new RecordWorkManager()
	using first = manager.reserveUpload(24 * 1024 * 1024)
	using _second = manager.reserveUpload(24 * 1024 * 1024)
	expect(() => manager.reserveUpload(24 * 1024 * 1024)).toThrow(RecordWorkCapacityError)
	first[Symbol.dispose]()
	using replacement = manager.reserveUpload(24 * 1024 * 1024)
	expect(replacement.byteLength).toBe(24 * 1024 * 1024)
})

test('drain returns false while admitted upload remains active', async () => {
	const manager = new RecordWorkManager()
	const reservation = manager.reserveUpload(1)
	reservation.schedule(() => new Promise(() => {}))
	expect(await manager.drain(1)).toBe(false)
})

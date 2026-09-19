import { expect, mock, test } from 'bun:test'
import { startEventLoopWatchdog } from './eventLoopWatchdog'

test('reports one delayed interval and stops scheduled sampling', () => {
	let now = 1_000
	let sample = () => {}
	const timer = { unref: mock(() => {}) } as unknown as ReturnType<typeof setInterval>
	const cancel = mock((_timer: ReturnType<typeof setInterval>) => {})
	const onStall = mock((_delayMs: number) => {})
	const watchdog = startEventLoopWatchdog({
		intervalMs: 1_000,
		thresholdMs: 5_000,
		now: () => now,
		onStall,
		schedule: (callback) => {
			sample = callback
			return timer
		},
		cancel,
	})
	expect(timer.unref).toHaveBeenCalledTimes(1)
	now = 7_500
	sample()
	expect(onStall).toHaveBeenCalledWith(5_500)
	watchdog.stop()
	watchdog.stop()
	expect(cancel).toHaveBeenCalledTimes(1)
	now = 20_000
	sample()
	expect(onStall).toHaveBeenCalledTimes(1)
})

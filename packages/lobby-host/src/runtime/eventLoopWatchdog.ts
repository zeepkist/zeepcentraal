import { eventLoopDelay } from './telemetry'

type WatchdogTimer = ReturnType<typeof setInterval>

interface EventLoopWatchdogOptions {
	cancel?: (timer: WatchdogTimer) => void
	intervalMs?: number
	now?: () => number
	onStall?: (delayMs: number) => void
	schedule?: (callback: () => void, intervalMs: number) => WatchdogTimer
	thresholdMs?: number
}

export function startEventLoopWatchdog(options: EventLoopWatchdogOptions = {}) {
	const intervalMs = options.intervalMs ?? 1_000
	const thresholdMs = options.thresholdMs ?? 5_000
	const now = options.now ?? (() => performance.now())
	const schedule = options.schedule ?? ((callback, ms) => setInterval(callback, ms))
	const cancel = options.cancel ?? clearInterval
	const onStall =
		options.onStall ??
		((delayMs: number) =>
			console.warn(`Lobby host event loop delayed by ${Math.round(delayMs)}ms.`))
	let expectedAt = now() + intervalMs
	let stopped = false
	const timer = schedule(() => {
		if (stopped) return
		const current = now()
		const delayMs = Math.max(0, current - expectedAt)
		expectedAt = current + intervalMs
		eventLoopDelay.record(delayMs)
		if (delayMs >= thresholdMs) onStall(delayMs)
	}, intervalMs)
	timer.unref?.()
	return {
		stop() {
			if (stopped) return
			stopped = true
			cancel(timer)
		},
	}
}

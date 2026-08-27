export type AdmissionStats = {
	active: number
	queued: number
}

type QueuedTask = {
	run: () => Promise<unknown>
	resolve: (value: unknown) => void
	reject: (reason?: unknown) => void
}

export class AdmissionClosedError extends Error {
	constructor() {
		super('Admission controller is closed')
	}
}

export type AdmissionController = {
	admit<T>(task: () => Promise<T>): Promise<T> | undefined
	dispose(): Promise<void>
	stats(): AdmissionStats
}

export function createAdmissionController(
	maxConcurrent: number,
	maxQueued: number,
	onStatsChange?: (stats: AdmissionStats) => void,
): AdmissionController {
	let active = 0
	let disposed = false
	let resolveDrain: (() => void) | undefined
	let disposePromise: Promise<void> | undefined
	const queue: QueuedTask[] = []

	function stats() {
		return { active, queued: queue.length }
	}

	function notify() {
		onStatsChange?.(stats())
	}

	function start(task: QueuedTask) {
		active += 1
		notify()
		void (async () => {
			try {
				const value = await task.run()
				task.resolve(value)
			} catch (error) {
				task.reject(error)
			} finally {
				active -= 1
				pump()
				notify()
				if (disposed && active === 0) resolveDrain?.()
			}
		})()
	}

	function pump() {
		while (!disposed && active < maxConcurrent) {
			const task = queue.shift()
			if (!task) break
			start(task)
		}
	}

	return {
		admit<T>(run: () => Promise<T>) {
			if (disposed) return undefined
			if (active >= maxConcurrent && queue.length >= maxQueued) return undefined

			const promise = new Promise<T>((resolve, reject) => {
				const task: QueuedTask = {
					run,
					resolve: (value) => resolve(value as T),
					reject,
				}
				if (active < maxConcurrent) start(task)
				else {
					queue.push(task)
					notify()
				}
			})
			return promise
		},
		dispose() {
			if (disposePromise) return disposePromise
			disposed = true
			const error = new AdmissionClosedError()
			for (const task of queue.splice(0)) task.reject(error)
			notify()
			disposePromise =
				active === 0
					? Promise.resolve()
					: new Promise<void>((resolve) => {
							resolveDrain = resolve
						})
			return disposePromise
		},
		stats,
	}
}

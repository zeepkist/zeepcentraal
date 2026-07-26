export interface ClusterWorkerLike {
	isDead(): boolean
	kill(signal?: NodeJS.Signals): void
	off(event: 'exit', listener: () => void): unknown
	once(event: 'exit', listener: () => void): unknown
}

export const PRIMARY_SHUTDOWN_TIMEOUT_MS = 10_000

export function onceAsync<TArgument>(handler: (argument: TArgument) => Promise<void>) {
	let activeShutdown: Promise<void> | undefined

	return (argument: TArgument) => {
		activeShutdown ??= handler(argument)
		return activeShutdown
	}
}

export async function stopClusterWorkers(
	workers: ClusterWorkerLike[],
	signal: NodeJS.Signals,
	timeoutMs = PRIMARY_SHUTDOWN_TIMEOUT_MS,
): Promise<boolean> {
	const pendingWorkers = new Set(workers.filter((worker) => !worker.isDead()))
	if (pendingWorkers.size === 0) {
		return true
	}

	let resolveAllWorkers: (() => void) | undefined
	const allWorkersExited = new Promise<void>((resolve) => {
		resolveAllWorkers = resolve
	})
	const exitListeners = new Map<ClusterWorkerLike, () => void>()

	for (const worker of pendingWorkers) {
		const onExit = () => {
			if (!pendingWorkers.delete(worker)) {
				return
			}
			if (pendingWorkers.size === 0) {
				resolveAllWorkers?.()
			}
		}
		exitListeners.set(worker, onExit)
		worker.once('exit', onExit)
		if (worker.isDead()) {
			onExit()
		}
	}

	for (const worker of pendingWorkers) {
		worker.kill(signal)
	}

	let timeout: ReturnType<typeof setTimeout> | undefined
	const stoppedCleanly = await Promise.race([
		allWorkersExited.then(() => true),
		new Promise<boolean>((resolve) => {
			timeout = setTimeout(() => resolve(false), timeoutMs)
		}),
	])

	if (timeout) {
		clearTimeout(timeout)
	}

	for (const [worker, listener] of exitListeners) {
		worker.off('exit', listener)
	}

	if (!stoppedCleanly) {
		for (const worker of pendingWorkers) {
			worker.kill('SIGKILL')
		}
	}

	return stoppedCleanly
}

export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 8_000
export const FORCED_SHUTDOWN_TIMEOUT_MS = 1_000

export type ServerShutdownResult = 'graceful' | 'forced' | 'timed-out'

export interface StoppableServer {
	stop(closeActiveConnections?: boolean): PromiseLike<unknown> | undefined
}

async function completesWithin(
	operation: PromiseLike<unknown> | undefined,
	timeoutMs: number,
): Promise<boolean> {
	if (!operation) return true

	let timeout: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			Promise.resolve(operation).then(() => true),
			new Promise<boolean>((resolve) => {
				timeout = setTimeout(() => resolve(false), timeoutMs)
			}),
		])
	} finally {
		if (timeout) clearTimeout(timeout)
	}
}

export async function stopServerWithEscalation(
	server: StoppableServer,
	gracefulTimeoutMs = GRACEFUL_SHUTDOWN_TIMEOUT_MS,
	forcedTimeoutMs = FORCED_SHUTDOWN_TIMEOUT_MS,
): Promise<ServerShutdownResult> {
	if (await completesWithin(server.stop(), gracefulTimeoutMs)) return 'graceful'
	if (await completesWithin(server.stop(true), forcedTimeoutMs)) return 'forced'
	return 'timed-out'
}

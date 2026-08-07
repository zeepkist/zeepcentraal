import type { DiscordBotConfig } from './types'

const REQUEST_TIMEOUT_MS = 5_000
const RETRY_DELAY_MS = 5_000

type DependencyStatus = 'ready' | 'timeout' | 'unavailable' | `http-${number}`

export type DiscordReadinessFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>

export type DiscordDependencyReadiness = {
	backend: DependencyStatus
	graphql: DependencyStatus
}

type CheckDiscordDependenciesOptions = {
	config: DiscordBotConfig
	fetchImpl?: DiscordReadinessFetch
	requestTimeoutMs?: number
	signal: AbortSignal
}

export type WaitForDiscordDependenciesOptions = CheckDiscordDependenciesOptions & {
	log: (...values: unknown[]) => void
	retryDelayMs?: number
	sleepImpl?: typeof waitForDependencyRetry
}

async function checkDependency(
	url: URL,
	options: Pick<CheckDiscordDependenciesOptions, 'fetchImpl' | 'requestTimeoutMs' | 'signal'>,
): Promise<DependencyStatus> {
	const fetchImpl = options.fetchImpl ?? fetch
	const timeoutSignal = AbortSignal.timeout(options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS)
	try {
		const response = await fetchImpl(url, {
			headers: {
				accept: 'application/json',
				'cache-control': 'no-cache',
			},
			signal: AbortSignal.any([options.signal, timeoutSignal]),
		})
		const status: DependencyStatus = response.ok ? 'ready' : `http-${response.status}`
		try {
			await response.body?.cancel()
		} catch {
			// Probe status is authoritative even if response stream cleanup fails.
		}
		return status
	} catch (error) {
		if (options.signal.aborted) throw error
		return timeoutSignal.aborted ? 'timeout' : 'unavailable'
	}
}

export async function checkDiscordDependencies({
	config,
	fetchImpl,
	requestTimeoutMs,
	signal,
}: CheckDiscordDependenciesOptions): Promise<DiscordDependencyReadiness> {
	const [backend, graphql] = await Promise.all([
		checkDependency(new URL('/healthz', config.backendUrl), {
			fetchImpl,
			requestTimeoutMs,
			signal,
		}),
		checkDependency(new URL('/readyz', config.graphql.httpUrl), {
			fetchImpl,
			requestTimeoutMs,
			signal,
		}),
	])
	return { backend, graphql }
}

export function waitForDependencyRetry(delayMs: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve()
			return
		}

		const finish = () => {
			clearTimeout(timeout)
			signal.removeEventListener('abort', finish)
			resolve()
		}
		const timeout = setTimeout(finish, delayMs)
		signal.addEventListener('abort', finish, { once: true })
	})
}

export async function waitForDiscordDependencies({
	config,
	fetchImpl,
	log,
	requestTimeoutMs,
	retryDelayMs = RETRY_DELAY_MS,
	signal,
	sleepImpl = waitForDependencyRetry,
}: WaitForDiscordDependenciesOptions): Promise<boolean> {
	log('Waiting for Discord dependencies')
	let previousStatus: string | undefined

	while (!signal.aborted) {
		let readiness: DiscordDependencyReadiness
		try {
			readiness = await checkDiscordDependencies({
				config,
				fetchImpl,
				requestTimeoutMs,
				signal,
			})
		} catch (error) {
			if (signal.aborted) return false
			throw error
		}

		if (readiness.backend === 'ready' && readiness.graphql === 'ready') {
			log('Discord dependencies ready')
			return true
		}

		const status = `backend=${readiness.backend} graphql=${readiness.graphql}`
		if (status !== previousStatus) {
			log(`Discord dependencies unavailable: ${status}`)
			previousStatus = status
		}
		await sleepImpl(retryDelayMs, signal)
	}

	return false
}

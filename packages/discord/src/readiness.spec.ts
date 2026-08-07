import { expect, mock, test } from 'bun:test'
import { testConfig } from '../test/mocks'
import {
	checkDiscordDependencies,
	type DiscordReadinessFetch,
	waitForDependencyRetry,
	waitForDiscordDependencies,
} from './readiness'

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

test('dependency check targets public health routes concurrently', async () => {
	const requests: string[] = []
	const bothStarted = deferred()
	const release = deferred()
	const fetchImpl: DiscordReadinessFetch = mock(async (input: string | URL | Request) => {
		requests.push(String(input))
		if (requests.length === 2) bothStarted.resolve()
		await release.promise
		return Response.json({ status: 'ok' })
	})
	const controller = new AbortController()

	const checking = checkDiscordDependencies({
		config: testConfig,
		fetchImpl,
		signal: controller.signal,
	})
	await bothStarted.promise
	expect(requests).toEqual([
		'https://backend.example.test/healthz',
		'https://graphql.example.test/readyz',
	])
	release.resolve()
	expect(await checking).toEqual({ backend: 'ready', graphql: 'ready' })
})

test('dependency check normalizes HTTP, transport, and timeout failures', async () => {
	const controller = new AbortController()
	const failed = await checkDiscordDependencies({
		config: testConfig,
		fetchImpl: mock(async (input: string | URL | Request) => {
			if (String(input).endsWith('/healthz')) return new Response(null, { status: 503 })
			throw new Error('connection refused')
		}),
		signal: controller.signal,
	})
	expect(failed).toEqual({ backend: 'http-503', graphql: 'unavailable' })

	const timedOut = await checkDiscordDependencies({
		config: testConfig,
		fetchImpl: mock(
			async (_input: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
						once: true,
					})
				}),
		),
		requestTimeoutMs: 1,
		signal: controller.signal,
	})
	expect(timedOut).toEqual({ backend: 'timeout', graphql: 'timeout' })
})

test('dependency wait retries until both are ready without repeating unchanged status logs', async () => {
	let backendChecks = 0
	const fetchImpl: DiscordReadinessFetch = mock(async (input: string | URL | Request) => {
		if (String(input).endsWith('/healthz')) {
			backendChecks++
			return new Response(null, { status: backendChecks < 3 ? 503 : 200 })
		}
		return new Response(null, { status: 200 })
	})
	const messages: string[] = []
	const log = mock((message: unknown) => messages.push(String(message)))
	const sleepImpl = mock(async () => {})
	const controller = new AbortController()

	expect(
		await waitForDiscordDependencies({
			config: testConfig,
			fetchImpl,
			log,
			signal: controller.signal,
			sleepImpl,
		}),
	).toBe(true)
	expect(backendChecks).toBe(3)
	expect(fetchImpl).toHaveBeenCalledTimes(6)
	expect(sleepImpl).toHaveBeenCalledTimes(2)
	expect(sleepImpl).toHaveBeenCalledWith(5_000, controller.signal)
	expect(messages).toEqual([
		'Waiting for Discord dependencies',
		'Discord dependencies unavailable: backend=http-503 graphql=ready',
		'Discord dependencies ready',
	])
})

test('dependency wait and retry delay stop when startup is aborted', async () => {
	const controller = new AbortController()
	const bothStarted = deferred()
	let requestCount = 0
	const fetchImpl: DiscordReadinessFetch = mock(
		async (_input: string | URL | Request, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				requestCount++
				if (requestCount === 2) bothStarted.resolve()
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
					once: true,
				})
			}),
	)
	const waiting = waitForDiscordDependencies({
		config: testConfig,
		fetchImpl,
		log: mock(() => {}),
		signal: controller.signal,
	})
	await bothStarted.promise
	controller.abort()
	expect(await waiting).toBe(false)

	const retryController = new AbortController()
	const retry = waitForDependencyRetry(60_000, retryController.signal)
	retryController.abort()
	await retry
	await waitForDependencyRetry(60_000, retryController.signal)

	const retryWaitController = new AbortController()
	expect(
		await waitForDiscordDependencies({
			config: testConfig,
			fetchImpl: mock(async () => new Response(null, { status: 503 })),
			log: mock(() => {}),
			signal: retryWaitController.signal,
			sleepImpl: mock(async () => retryWaitController.abort()),
		}),
	).toBe(false)
})

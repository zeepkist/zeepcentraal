import assert from 'node:assert/strict'
import { createServer } from 'node:http2'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const entry = fileURLToPath(new URL('../../.output/server/telemetry.mjs', import.meta.url))
assert(await Bun.file(entry).exists(), 'Build packages/web before running test:memory')

const collector = createServer()
const exportsByPath = new Map<string, number>()
collector.on('stream', (stream, headers) => {
	stream.on('error', () => {})
	stream.on('data', () => {})
	stream.on('end', () => {
		const path = String(headers[':path'])
		exportsByPath.set(path, (exportsByPath.get(path) ?? 0) + 1)
		stream.respond(
			{ ':status': 200, 'content-type': 'application/grpc' },
			{ waitForTrailers: true },
		)
		stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }))
		// Empty protobuf ExportResponse in an uncompressed gRPC frame.
		stream.end(Buffer.alloc(5))
	})
})
await new Promise<void>((resolve, reject) => {
	collector.once('error', reject)
	collector.listen(0, '127.0.0.1', resolve)
})
const collectorAddress = collector.address()
assert(collectorAddress && typeof collectorAddress === 'object')
const collectorUrl = `http://127.0.0.1:${collectorAddress.port}`

function freePort() {
	const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
	const port = server.port
	assert(port)
	server.stop(true)
	return port
}

const upstreamPort = freePort()
const upstreamUrl = `http://127.0.0.1:${upstreamPort}`
const fixture = Bun.spawn([process.execPath, '--no-env-file', 'tests/upgrade/server.ts'], {
	cwd: webRoot,
	env: { ...process.env, WEB_TEST_UPSTREAM_PORT: String(upstreamPort) },
	stdout: 'ignore',
	stderr: 'pipe',
})

async function ready(url: string, child: { exitCode: number | null }) {
	const deadline = Date.now() + 30_000
	while (Date.now() < deadline) {
		assert.equal(child.exitCode, null, `Test server exited before readiness: ${url}`)
		try {
			const response = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(1_000) })
			await response.arrayBuffer()
			if (response.ok) return
		} catch {
			// The listener may not exist until production modules finish loading.
		}
		await Bun.sleep(50)
	}
	throw new Error(`Test server did not become ready: ${url}`)
}

const paths = ['/privacy', '/terms', '/', '/levels', '/level/fixture-hydration-level']
const maximumGrowth = 67_108_864
const maximumRss = 1_073_741_824

async function workload(telemetry: boolean, concurrency: number) {
	const url = `http://127.0.0.1:${freePort()}`
	let resolveSample: ((memory: NodeJS.MemoryUsage) => void) | undefined
	let sampleId = 0
	let diagnostics = ''
	const child = Bun.spawn(
		[process.execPath, '--no-env-file', '--preload', './tests/memory/preload.ts', entry],
		{
			cwd: webRoot,
			env: {
				...process.env,
				NODE_ENV: 'production',
				NITRO_HOST: '127.0.0.1',
				NITRO_PORT: new URL(url).port,
				DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
				NUXT_PUBLIC_BACKEND_URL: upstreamUrl,
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: `${upstreamUrl}/graphql`,
				NUXT_PUBLIC_GRAPHQL_WS_URL: upstreamUrl.replace('http:', 'ws:'),
				NUXT_GITHUB_TOKEN: 'fake-fixture-github',
				NUXT_MODIO_API_KEY: 'fake-fixture-modio',
				NUXT_MODIO_API_ENDPOINT: `${upstreamUrl}/modio/`,
				OTEL_SDK_DISABLED: String(!telemetry),
				OTEL_EXPORTER_OTLP_ENDPOINT: collectorUrl,
				OPENTELEMETRY_COLLECTOR_URL: collectorUrl,
				OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'http',
			},
			stdout: 'pipe',
			stderr: 'pipe',
			ipc(message: unknown) {
				if (typeof message !== 'object' || message === null) return
				const result = message as { sample?: number; memory?: NodeJS.MemoryUsage }
				if (result.sample === sampleId && result.memory) resolveSample?.(result.memory)
			},
		},
	)
	async function capture(stream: ReadableStream<Uint8Array>) {
		const decoder = new TextDecoder()
		for await (const chunk of stream)
			diagnostics = (diagnostics + decoder.decode(chunk)).slice(-4_000)
	}
	const output = Promise.allSettled([capture(child.stdout), capture(child.stderr)])
	async function sample(requests: number) {
		const memory = await new Promise<NodeJS.MemoryUsage>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Memory sample timed out')), 10_000)
			resolveSample = (value) => {
				clearTimeout(timeout)
				resolve(value)
			}
			child.send({ sample: ++sampleId })
		})
		assert(memory.rss < maximumRss, 'SSR memory test exceeded 1 GiB RSS')
		console.log(JSON.stringify({ telemetry, concurrency, requests, ...memory }))
		return memory
	}
	async function requests(count: number) {
		let index = 0
		await Promise.all(
			Array.from({ length: concurrency }, async () => {
				while (index < count) {
					const path = paths[index++ % paths.length]
					const response = await fetch(`${url}${path}`, {
						signal: AbortSignal.timeout(30_000),
					})
					const html = await response.text()
					assert.equal(response.status, 200, `SSR ${path} status`)
					assert(html.includes('<!DOCTYPE html>'), `SSR ${path} did not return HTML`)
				}
			}),
		)
	}
	try {
		await ready(url, child)
		await requests(200)
		const baseline = await sample(200)
		let final = baseline
		for (let completed = 300; completed <= 1_200; completed += 100) {
			await requests(100)
			final = await sample(completed)
		}
		assert(
			final.heapUsed - baseline.heapUsed < maximumGrowth,
			`SSR heap grew by ${final.heapUsed - baseline.heapUsed} bytes; limit is 64 MiB`,
		)
		if (telemetry) {
			const deadline = Date.now() + 15_000
			while (Date.now() < deadline) {
				if (
					['TraceService', 'MetricsService', 'LogsService'].every((service) =>
						[...exportsByPath.keys()].some((path) => path.includes(service)),
					)
				)
					break
				await Bun.sleep(100)
			}
			for (const service of ['TraceService', 'MetricsService', 'LogsService'])
				assert(
					[...exportsByPath.keys()].some((path) => path.includes(service)),
					`No ${service} export`,
				)
		}
	} catch (error) {
		throw new Error(
			`SSR memory workload failed (telemetry=${telemetry}, concurrency=${concurrency})\n${diagnostics}`,
			{ cause: error },
		)
	} finally {
		child.kill()
		await child.exited
		await output
	}
}

try {
	await ready(upstreamUrl, fixture)
	for (const telemetry of [false, true]) {
		for (const concurrency of [1, 10]) {
			exportsByPath.clear()
			await workload(telemetry, concurrency)
		}
	}
	console.log('SSR memory regression checks passed')
} finally {
	fixture.kill()
	await fixture.exited
	collector.close()
}

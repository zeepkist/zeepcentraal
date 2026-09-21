// Standalone generator: no application runtime or package imports.

import { writeFileSync } from 'node:fs'
import http from 'node:http'

const seconds = Number(process.argv[2] ?? '20')
const mode = process.argv[3] ?? 'closed'
const amount = Number(process.argv[4] ?? '32')
const output = process.argv[5] ?? '/results/load.json'
if (!(seconds > 0 && seconds <= 300 && amount > 0 && amount <= 1000))
	throw new Error('Invalid bounds')
if (!['closed', 'rate'].includes(mode)) throw new Error('Invalid mode')
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 })
const latencies: number[] = []
const acknowledgements: number[] = []
const serviceLatencies: number[] = []
const counts = { profile: 0, autocomplete: 0, page: 0, feed: 0 }
const epoch = Date.now() * 1000
const scenario = process.argv[6] ?? 'mixed'
const errorSamples: string[] = []
let errors = 0
let dropped = 0
let inflight = 0
let index = 0
let bytes = 0
let startedUnixSeconds = Date.now() / 1000
let started = performance.now()
let deadline = started + seconds * 1000
let cpuStart = process.cpuUsage()

async function request(i: number, scheduled: number): Promise<void> {
	const kind = (
		scenario === 'mixed' ? ['profile', 'autocomplete', 'page', 'feed'][i % 4] : scenario
	) as keyof typeof counts
	const path = '/evaluation/discord'
	const body = JSON.stringify({ kind, id: epoch + i, owner: 'fixture-owner' })
	const begin = performance.now()
	inflight++
	await new Promise<void>((resolve) => {
		const req = http.request(
			{
				hostname: '127.0.0.1',
				port: 4310,
				path,
				agent,
				method: body ? 'POST' : 'GET',
				headers: body
					? {
							'Content-Type': 'application/json',
							'Content-Length': Buffer.byteLength(body),
						}
					: {},
			},
			(res) => {
				const chunks: Buffer[] = []
				res.on('data', (chunk) => chunks.push(chunk))
				res.on('end', () => {
					try {
						const text = Buffer.concat(chunks).toString()
						bytes += Buffer.byteLength(text)
						if (res.statusCode !== 200 || JSON.parse(text).ok !== true)
							throw new Error(`Status ${res.statusCode}: ${text}`)
						if (typeof JSON.parse(text).ackMs === 'number')
							acknowledgements.push(JSON.parse(text).ackMs)
						counts[kind]++
					} catch (error) {
						if (errorSamples.length < 3) errorSamples.push(String(error))
						errors++
					}
					resolve()
				})
				res.on('error', () => {
					errors++
					resolve()
				})
			},
		)
		req.setTimeout(5000, () => req.destroy(new Error('Timeout')))
		req.on('error', () => {
			errors++
			resolve()
		})
		if (body) req.write(body)
		req.end()
	})
	const end = performance.now()
	latencies.push(end - scheduled)
	serviceLatencies.push(end - begin)
	inflight--
}

// Prime the client runtime and HTTP pool before starting the offered-load clock.
// Otherwise Bun's first node:http initialization creates an artificial arrival backlog.
await Promise.all(Array.from({ length: 32 }, (_, i) => request(i, performance.now())))
if (errors) throw new Error(`Client priming failed: ${errorSamples.join('; ')}`)
const primerCounts = { ...counts }
counts.profile = counts.autocomplete = counts.page = counts.feed = 0
index = 32
latencies.length = serviceLatencies.length = acknowledgements.length = 0
bytes = 0
startedUnixSeconds = Date.now() / 1000
started = performance.now()
deadline = started + seconds * 1000
cpuStart = process.cpuUsage()

if (mode === 'closed') {
	await Promise.all(
		Array.from({ length: amount }, async () => {
			while (performance.now() < deadline) await request(index++, performance.now())
		}),
	)
} else {
	const tasks = new Set<Promise<void>>()
	const total = 32 + Math.floor(seconds * amount)
	while (index < total) {
		const now = performance.now()
		while (index < total && started + ((index - 32) * 1000) / amount <= now) {
			const i = index++
			if (inflight >= 64) {
				dropped++
				continue
			}
			const task = request(i, started + ((i - 32) * 1000) / amount)
			tasks.add(task)
			void task.finally(() => tasks.delete(task))
		}
		await Bun.sleep(1)
	}
	await Promise.all(tasks)
	if (performance.now() < deadline) await Bun.sleep(deadline - performance.now())
}
const elapsed = (performance.now() - started) / 1000
const cpu = process.cpuUsage(cpuStart)
const percentiles = (values: number[]) => {
	values.sort((a, b) => a - b)
	const at = (q: number) =>
		values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))] ?? null
	return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(1) }
}
agent.destroy()
const result = {
	startedUnixSeconds,
	endedUnixSeconds: Date.now() / 1000,
	mode,
	amount,
	requestedSeconds: seconds,
	elapsedSeconds: elapsed,
	completed: latencies.length,
	successful: Object.values(counts).reduce((a, b) => a + b, 0),
	errors,
	errorSamples,
	primerCounts,
	dropped,
	rps: Object.values(counts).reduce((a, b) => a + b, 0) / elapsed,
	counts,
	bytes,
	latencyMs: percentiles(latencies),
	acknowledgementMs: acknowledgements.length ? percentiles(acknowledgements) : null,
	serviceLatencyMs: percentiles(serviceLatencies),
	generatorCpuCores: (cpu.user + cpu.system) / 1000000 / elapsed,
}
writeFileSync(output, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
if (errors || dropped) process.exitCode = 1

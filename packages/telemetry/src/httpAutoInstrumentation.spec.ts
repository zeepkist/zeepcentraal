import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const bootstrap = fileURLToPath(new URL('./fixtures/httpBootstrap.ts', import.meta.url))

async function run(command: string[]) {
	const child = Bun.spawn(command, { stderr: 'pipe', stdout: 'pipe' })
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	])
	expect(exitCode, stderr).toBe(0)
	const line = stdout.split('\n').find((candidate) => candidate.startsWith('OTEL_HTTP_SPANS='))
	expect(line).toBeDefined()
	return JSON.parse(line?.slice('OTEL_HTTP_SPANS='.length) ?? '[]') as Array<{
		kind: number
		name: string
	}>
}

function expectClientAndServerSpans(spans: Array<{ kind: number; name: string }>) {
	expect(spans.some((span) => span.kind === 1)).toBe(true)
	expect(spans.some((span) => span.kind === 2)).toBe(true)
}

describe('Bun node:http auto-instrumentation', () => {
	test('patches node:http loaded after SDK start', async () => {
		expectClientAndServerSpans(await run([process.execPath, bootstrap]))
	}, 30_000)

	test('works in compiled Bun executable', async () => {
		const directory = mkdtempSync(join(dirname(bootstrap), '.otel-http-'))
		const executable = join(directory, process.platform === 'win32' ? 'fixture.exe' : 'fixture')
		try {
			const result = await Bun.build({
				compile: { outfile: executable },
				entrypoints: [bootstrap],
				target: 'bun',
			})
			expect(result.success, result.logs.map(String).join('\n')).toBe(true)
			const output = result.outputs[0]?.path
			expect(output).toBeDefined()
			expectClientAndServerSpans(await run([output ?? executable]))
		} finally {
			rmSync(directory, { force: true, recursive: true })
		}
	}, 30_000)
})

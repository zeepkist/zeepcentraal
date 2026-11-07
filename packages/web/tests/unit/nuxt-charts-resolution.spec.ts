import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test('v3 registers chart components and resolves enums without legacy aliases', async () => {
	const check = Bun.spawn(
		[
			process.execPath,
			'--no-env-file',
			fileURLToPath(new URL('../fixtures/nuxtChartsModule.ts', import.meta.url)),
		],
		{
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)
	const [exitCode, stderr] = await Promise.all([check.exited, new Response(check.stderr).text()])
	expect(exitCode, stderr).toBe(0)
})

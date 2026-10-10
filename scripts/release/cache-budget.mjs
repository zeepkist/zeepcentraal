import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function enforceCacheBudget(run = spawnSync) {
	const stopped = run('kache', ['daemon', 'stop'], { encoding: 'utf8', timeout: 30_000 })
	if (stopped.status !== 0)
		process.stderr.write(
			'Kache daemon shutdown failed; attempting GC with built-in local fallback.\n',
		)

	const collected = run('kache', ['gc', '--json'], { encoding: 'utf8', timeout: 120_000 })
	if (collected.stderr) process.stderr.write(collected.stderr)
	if (collected.status !== 0) throw new Error('Kache GC failed; cache export skipped')
	const report = JSON.parse(collected.stdout)
	process.stdout.write(`${collected.stdout.trim()}\n`)
	if (report.success !== true || report.skipped !== false)
		throw new Error('Kache GC did not complete; cache export skipped')
	const { store_bytes: bytes, store_limit_bytes: limit } = report.disk ?? {}
	if (!Number.isSafeInteger(bytes) || bytes < 0 || !Number.isSafeInteger(limit) || limit <= 0)
		throw new Error('Kache GC returned an invalid store budget; cache export skipped')
	if (bytes > limit) throw new Error('Kache store exceeds budget; cache export skipped')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	enforceCacheBudget()
}

import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import { withActiveSpan } from '@zeepkist/telemetry'
import type { WorkshopDownload, WorkshopDownloader } from './types'

const STEAMCMD_TIMEOUT_MS = 10 * 60_000
const STEAMCMD_KILL_GRACE_MS = 5_000
const LOG_TAIL_BYTES = 64 * 1024

export class SteamCmdDownloader implements WorkshopDownloader {
	public constructor(
		private readonly appId: string,
		private readonly executable = jobsConfig.steam.cmdPath,
	) {}

	public async download(workshopIds: bigint[]): Promise<WorkshopDownload> {
		return withActiveSpan(
			'steamcmd.download',
			{ attributes: { 'workshop.item.count': workshopIds.length } },
			async (span) => {
				const root = await mkdtemp(join(tmpdir(), 'zeepcentraal-workshop-'))
				try {
					const argumentsList = ['+force_install_dir', root, '+login', 'anonymous']
					for (const workshopId of workshopIds) {
						argumentsList.push(
							'+workshop_download_item',
							this.appId,
							workshopId.toString(),
						)
					}
					argumentsList.push('+quit')
					const process = Bun.spawn([this.executable, ...argumentsList], {
						stdout: 'pipe',
						stderr: 'pipe',
					})
					let forceKill: ReturnType<typeof setTimeout> | undefined
					const timeout = setTimeout(() => {
						process.kill('SIGTERM')
						forceKill = setTimeout(
							() => process.kill('SIGKILL'),
							STEAMCMD_KILL_GRACE_MS,
						)
					}, STEAMCMD_TIMEOUT_MS)
					let exitCode: number
					try {
						;[exitCode] = await Promise.all([
							process.exited,
							readStreamTail(process.stdout),
							readStreamTail(process.stderr),
						])
					} finally {
						clearTimeout(timeout)
						if (forceKill) clearTimeout(forceKill)
					}
					const usage = process.resourceUsage()
					if (usage)
						span.addEvent('steamcmd.resources', {
							'process.memory.peak_rss': usage.maxRSS,
						})
					span.addEvent('steamcmd.exit', { 'process.exit.code': exitCode })
					if (exitCode !== 0) {
						throw new Error(`SteamCMD failed with exit code ${exitCode}`)
					}

					const contentRoot = join(root, 'steamapps', 'workshop', 'content', this.appId)
					const downloadedIds = new Set(await readdir(contentRoot))
					const missing = workshopIds.filter((id) => !downloadedIds.has(id.toString()))
					if (missing.length > 0) {
						throw new Error(`SteamCMD omitted workshop items: ${missing.join(', ')}`)
					}
					let cleaned = false
					const cleanup = async () => {
						if (cleaned) return
						cleaned = true
						await rm(root, { recursive: true, force: true })
					}
					return {
						items: workshopIds.map((workshopId) => ({
							workshopId,
							directory: join(contentRoot, workshopId.toString()),
						})),
						cleanup,
						[Symbol.asyncDispose]: cleanup,
					}
				} catch (error) {
					await rm(root, { recursive: true, force: true })
					throw error
				}
			},
		)
	}
}

async function readStreamTail(stream: ReadableStream<Uint8Array>): Promise<string> {
	const tail = new Uint8Array(LOG_TAIL_BYTES)
	let length = 0
	for await (const chunk of stream) {
		if (chunk.byteLength >= tail.byteLength) {
			tail.set(chunk.subarray(chunk.byteLength - tail.byteLength))
			length = tail.byteLength
			continue
		}
		const overflow = Math.max(length + chunk.byteLength - tail.byteLength, 0)
		if (overflow > 0) {
			tail.copyWithin(0, overflow, length)
			length -= overflow
		}
		tail.set(chunk, length)
		length += chunk.byteLength
	}
	return new TextDecoder().decode(tail.subarray(0, length))
}

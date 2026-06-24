import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import type { WorkshopDownload, WorkshopDownloader } from './types'

export class SteamCmdDownloader implements WorkshopDownloader {
	public constructor(
		private readonly appId: string,
		private readonly executable = jobsConfig.steam.cmdPath,
	) {}

	public async download(workshopIds: bigint[]): Promise<WorkshopDownload> {
		const root = await mkdtemp(join(tmpdir(), 'zeepcentraal-workshop-'))
		try {
			const argumentsList = ['+force_install_dir', root, '+login', 'anonymous']
			for (const workshopId of workshopIds) {
				argumentsList.push('+workshop_download_item', this.appId, workshopId.toString())
			}
			argumentsList.push('+quit')
			const process = Bun.spawn([this.executable, ...argumentsList], {
				stdout: 'pipe',
				stderr: 'pipe',
			})
			const [exitCode, stdout, stderr] = await Promise.all([
				process.exited,
				new Response(process.stdout).text(),
				new Response(process.stderr).text(),
			])
			if (exitCode !== 0) {
				throw new Error(`SteamCMD failed (${exitCode}): ${stderr || stdout}`)
			}

			const contentRoot = join(root, 'steamapps', 'workshop', 'content', this.appId)
			const downloadedIds = new Set(await readdir(contentRoot))
			const missing = workshopIds.filter((id) => !downloadedIds.has(id.toString()))
			if (missing.length > 0) {
				throw new Error(`SteamCMD omitted workshop items: ${missing.join(', ')}`)
			}
			return {
				items: workshopIds.map((workshopId) => ({
					workshopId,
					directory: join(contentRoot, workshopId.toString()),
				})),
				cleanup: () => rm(root, { recursive: true, force: true }),
			}
		} catch (error) {
			await rm(root, { recursive: true, force: true })
			throw error
		}
	}
}

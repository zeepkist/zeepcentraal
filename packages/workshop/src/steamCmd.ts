import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import steamTotp from 'steam-totp'
import type { WorkshopDownload, WorkshopDownloader } from './types'

export interface SteamCmdCredentials {
	username?: string
	password?: string
}

export interface SteamCmdSpawnConfig {
	home?: string
	env?: NodeJS.ProcessEnv
}

export async function createSteamCmdLoginArguments({
	username,
	password,
}: SteamCmdCredentials): Promise<string[]> {
	const sharedSecret = jobsConfig.steam.sharedSecret

	if (username && password && sharedSecret) {
		const authCode = steamTotp.getAuthCode(sharedSecret)

		console.debug(`Generated Steam Guard code for ${username}: ${authCode}`)

		return ['+login', username]
		// return ['+login', username, password, authCode]
	} else {
		return ['+login', 'anonymous']
	}
}

export function createSteamCmdHomeEnvironment(home: string, env = process.env): NodeJS.ProcessEnv {
	return {
		...env,
		HOME: home,
		USERPROFILE: home,
		APPDATA: join(home, 'AppData', 'Roaming'),
		LOCALAPPDATA: join(home, 'AppData', 'Local'),
	}
}

export async function ensureSteamCmdHome(home: string): Promise<void> {
	await Promise.all([
		mkdir(home, { recursive: true }),
		mkdir(join(home, 'AppData', 'Roaming'), { recursive: true }),
		mkdir(join(home, 'AppData', 'Local'), { recursive: true }),
	])
}

export function createSteamCmdSpawnOptions({ home, env = process.env }: SteamCmdSpawnConfig) {
	const options: {
		stdout: 'pipe'
		stderr: 'pipe'
		cwd?: string
		env?: NodeJS.ProcessEnv
	} = {
		stdout: 'pipe',
		stderr: 'pipe',
	}
	if (home) {
		options.cwd = home
		options.env = createSteamCmdHomeEnvironment(home, env)
	}
	return options
}

export function redactSteamCmdOutput(output: string, credentials: SteamCmdCredentials): string {
	let redacted = output
	for (const secret of [credentials.username, credentials.password]) {
		if (secret) {
			redacted = redacted.split(secret).join('[redacted]')
		}
	}
	return redacted
}

export class SteamCmdDownloader implements WorkshopDownloader {
	public constructor(
		private readonly appId: string,
		private readonly executable = jobsConfig.steam.cmdPath,
	) {}

	public async download(workshopIds: bigint[]): Promise<WorkshopDownload> {
		const root = await mkdtemp(join(tmpdir(), 'zeepcentraal-workshop-'))
		const credentials = {
			username: jobsConfig.steam.username,
			password: jobsConfig.steam.password,
		}
		try {
			if (jobsConfig.steam.home) {
				await ensureSteamCmdHome(jobsConfig.steam.home)
			}
			const argumentsList = ['+force_install_dir', root]
			argumentsList.push(...(await createSteamCmdLoginArguments(credentials)))

			for (const workshopId of workshopIds) {
				argumentsList.push('+workshop_download_item', this.appId, workshopId.toString())
			}

			argumentsList.push('+quit')

			const process = Bun.spawn(
				[this.executable, ...argumentsList],
				createSteamCmdSpawnOptions({
					home: jobsConfig.steam.home,
				}),
			)

			const [exitCode, stdout, stderr] = await Promise.all([
				process.exited,
				new Response(process.stdout).text(),
				new Response(process.stderr).text(),
			])

			if (exitCode !== 0) {
				throw new Error(
					`SteamCMD failed (${exitCode}): ${redactSteamCmdOutput(stderr || stdout, credentials)}`,
				)
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

import { chmod, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import SteamUser from 'steam-user'

const TICKET_USER_DATA = 21_572

export interface SteamIdentity {
	name: string
	steamId: bigint
}

export class LobbySteamSession {
	private readonly client = new SteamUser({
		dataDirectory: null,
		enablePicsCache: false,
		renewRefreshTokens: true,
	})
	private identity: SteamIdentity | undefined

	constructor(
		private readonly refreshTokenFile: string,
		private readonly appId: number,
	) {
		this.client.on('error', () => {
			console.error('Steam client session error')
		})
	}

	async connect() {
		const refreshToken = (await readFile(this.refreshTokenFile, 'utf8')).trim()
		if (!refreshToken) {
			throw new Error('Steam refresh token file is empty')
		}
		this.client.on('refreshToken', (token) => {
			void this.persistRefreshToken(token).catch(() => {
				console.error('Failed to persist renewed Steam refresh token')
			})
		})

		await new Promise<void>((resolve, reject) => {
			const onError = () => reject(new Error('Steam client logon failed'))
			this.client.once('error', onError)
			this.client.once('loggedOn', () => {
				this.client.off('error', onError)
				resolve()
			})
			this.client.logOn({ refreshToken })
		})

		const steamId = this.client.steamID?.getSteamID64()
		if (!steamId) {
			throw new Error('Steam client did not provide an account ID')
		}
		const name =
			this.client.accountInfo?.name ??
			(await new Promise<string>((resolve) => {
				this.client.once('accountInfo', (accountName) => resolve(accountName))
			}))
		this.identity = { steamId: BigInt(steamId), name }
		return this.identity
	}

	async createEncryptedAppTicket() {
		if (!this.identity) {
			throw new Error('Steam client is not logged on')
		}
		const userData = Buffer.allocUnsafe(4)
		userData.writeUInt32LE(TICKET_USER_DATA)
		return this.client.createEncryptedAppTicket(this.appId, userData)
	}

	close() {
		this.client.logOff()
	}

	private async persistRefreshToken(refreshToken: string) {
		const temporaryFile = join(
			dirname(this.refreshTokenFile),
			`.steam-refresh-token.${process.pid}.tmp`,
		)
		await writeFile(temporaryFile, `${refreshToken}\n`, { encoding: 'utf8', mode: 0o600 })
		await chmod(temporaryFile, 0o600)
		await rename(temporaryFile, this.refreshTokenFile)
	}
}

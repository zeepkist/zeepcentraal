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
	private closed = false
	private readonly refreshTokenStore: SerializedRefreshTokenStore

	constructor(
		private readonly refreshTokenFile: string,
		private readonly appId: number,
	) {
		this.refreshTokenStore = new SerializedRefreshTokenStore(
			(token) => writeSteamRefreshTokenAtomically(this.refreshTokenFile, token),
			() => console.error('Failed to persist renewed Steam refresh token'),
		)
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
			this.refreshTokenStore.enqueue(token)
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
		await this.refreshTokenStore.flush()
		this.identity = { steamId: BigInt(steamId), name }
		return this.identity
	}

	async createEncryptedAppTicket() {
		if (!this.identity || !this.client.steamID) {
			throw new Error('Steam client is not logged on')
		}
		const userData = Buffer.allocUnsafe(4)
		userData.writeUInt32LE(TICKET_USER_DATA)
		const result: unknown = await this.client.createEncryptedAppTicket(this.appId, userData)
		return normalizeEncryptedAppTicket(result)
	}

	async close() {
		if (this.closed) return
		this.closed = true
		this.identity = undefined
		this.client.logOff()
		await this.refreshTokenStore.flush().catch(() => undefined)
	}
}

export class SerializedRefreshTokenStore {
	private pending = Promise.resolve()
	private writeError: Error | undefined

	constructor(
		private readonly write: (refreshToken: string) => Promise<void>,
		private readonly onError: () => void = () => {},
	) {}

	enqueue(refreshToken: string) {
		this.pending = this.pending
			.then(() => this.write(refreshToken))
			.catch((error) => {
				this.writeError =
					error instanceof Error ? error : new Error('Steam refresh token write failed')
				this.onError()
			})
	}

	async flush() {
		await this.pending
		if (this.writeError) throw this.writeError
	}
}

export async function writeSteamRefreshTokenAtomically(
	refreshTokenFile: string,
	refreshToken: string,
) {
	const temporaryFile = join(dirname(refreshTokenFile), `.steam-refresh-token.${process.pid}.tmp`)
	await writeFile(temporaryFile, `${refreshToken}\n`, { encoding: 'utf8', mode: 0o600 })
	await chmod(temporaryFile, 0o600)
	await rename(temporaryFile, refreshTokenFile)
}

export function normalizeEncryptedAppTicket(result: unknown) {
	const ticket = Buffer.isBuffer(result)
		? result
		: isObject(result) && Buffer.isBuffer(result.encryptedAppTicket)
			? result.encryptedAppTicket
			: undefined
	if (!ticket?.length) {
		throw new Error('Steam returned an invalid encrypted app ticket')
	}
	return ticket
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	normalizeEncryptedAppTicket,
	SerializedRefreshTokenStore,
	writeSteamRefreshTokenAtomically,
} from './steamSession'

describe('normalizeEncryptedAppTicket', () => {
	it('accepts the steam-user runtime response wrapper', () => {
		const ticket = Buffer.from([1, 2, 3])

		expect(normalizeEncryptedAppTicket({ encryptedAppTicket: ticket })).toBe(ticket)
	})

	it('keeps compatibility with the stale DefinitelyTyped return type', () => {
		const ticket = Buffer.from([1, 2, 3])

		expect(normalizeEncryptedAppTicket(ticket)).toBe(ticket)
	})

	it('rejects missing and empty tickets', () => {
		expect(() => normalizeEncryptedAppTicket({})).toThrow(
			'Steam returned an invalid encrypted app ticket',
		)
		expect(() => normalizeEncryptedAppTicket({ encryptedAppTicket: Buffer.alloc(0) })).toThrow(
			'Steam returned an invalid encrypted app ticket',
		)
	})
})

describe('Steam refresh token persistence', () => {
	it('serializes writes and flush waits for newest token', async () => {
		const writes: string[] = []
		let concurrent = 0
		let maxConcurrent = 0
		const store = new SerializedRefreshTokenStore(async (token) => {
			concurrent++
			maxConcurrent = Math.max(maxConcurrent, concurrent)
			await Bun.sleep(5)
			writes.push(token)
			concurrent--
		})

		store.enqueue('first-token')
		store.enqueue('second-token')
		await store.flush()

		expect(writes).toEqual(['first-token', 'second-token'])
		expect(maxConcurrent).toBe(1)
	})

	it('atomically writes token with mode 0600', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'zc-steam-token-'))
		const tokenFile = join(directory, 'steam-refresh-token')
		try {
			await writeSteamRefreshTokenAtomically(tokenFile, 'private-test-token')
			expect(await readFile(tokenFile, 'utf8')).toBe('private-test-token\n')
			if (process.platform !== 'win32') {
				expect((await stat(tokenFile)).mode & 0o777).toBe(0o600)
			}
		} finally {
			await rm(directory, { force: true, recursive: true })
		}
	})
})

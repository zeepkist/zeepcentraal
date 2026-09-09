import { expect, mock, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ManagedLobbyProfile } from '../profiles/contracts'

mock.module('@zeepkist/database', () => ({
	getManagedLobbyJoinId: async () => undefined,
	setManagedLobbyJoinId: async () => {},
}))
const { ManagedLobbyHost } = await import('./managedLobbyHost')

test('runtime accepts minimal profile without loading tournament services', async () => {
	const prepare = mock(async () => undefined)
	const stop = mock(() => {})
	const assign = mock(async () => {
		throw new Error('No asset: must not assign')
	})
	const profile: ManagedLobbyProfile = {
		name: 'minimal-test-profile',
		currentLevel: undefined,
		prepare,
		stop,
		createSession: () => {
			throw new Error('No asset: must not connect')
		},
	}
	const host = new ManagedLobbyHost(
		{
			key: 'test',
			room: { name: 'test', isPublic: false, maxPlayers: 2 },
			roundTimeSeconds: 900,
			assetPollMs: 60_000,
			messageRefreshMs: 60_000,
			reconnectMaxMs: 60_000,
		},
		{ assign },
		profile,
	)
	const running = host.run()
	await Bun.sleep(5)
	await host.stop()
	await running
	expect(prepare).toHaveBeenCalledTimes(1)
	expect(assign).not.toHaveBeenCalled()
	expect(stop).toHaveBeenCalledTimes(1)
})

test('generic modules cannot depend on concrete room profiles', () => {
	const root = fileURLToPath(new URL('../', import.meta.url))
	function inspect(directory: string) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name)
			if (entry.isDirectory()) inspect(path)
			else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
				const source = readFileSync(path, 'utf8')
				expect(source).not.toMatch(
					/(?:from\s*|import\s*\()['"][^'"]*(?:trackTournament|createProfile)/,
				)
				expect(source).not.toContain('tournamentType')
			}
		}
	}
	for (const directory of ['runtime', 'chat', 'leaderboard', 'broker', 'assets'])
		inspect(join(root, directory))
})

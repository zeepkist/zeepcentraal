import { expect, test } from 'bun:test'
import { join } from 'node:path'
import {
	createSteamCmdHomeEnvironment,
	createSteamCmdLoginArguments,
	createSteamCmdSpawnOptions,
	redactSteamCmdOutput,
} from './steamCmd'

/*
test('SteamCMD uses anonymous login without credentials', () => {
	expect(createSteamCmdLoginArguments({})).toEqual(['+login', 'anonymous'])
})

test('SteamCMD uses username and password when configured', () => {
	expect(
		createSteamCmdLoginArguments({
			username: 'steam-user',
			password: 'steam-password',
		}),
	).toEqual(['+login', 'steam-user', 'steam-password'])
})
*/

test('SteamCMD spawn options persist home when configured', () => {
	const options = createSteamCmdSpawnOptions({
		home: '/steamcmd-home',
		env: { PATH: '/usr/bin' },
	})

	expect(options.cwd).toBe('/steamcmd-home')
	expect(options.env).toMatchObject({
		APPDATA: join('/steamcmd-home', 'AppData', 'Roaming'),
		HOME: '/steamcmd-home',
		LOCALAPPDATA: join('/steamcmd-home', 'AppData', 'Local'),
		PATH: '/usr/bin',
		USERPROFILE: '/steamcmd-home',
	})
})

test('SteamCMD home environment includes Windows cache paths', () => {
	expect(createSteamCmdHomeEnvironment('C:/steamcmd-home', { PATH: 'C:/Windows' })).toMatchObject(
		{
			APPDATA: join('C:/steamcmd-home', 'AppData', 'Roaming'),
			HOME: 'C:/steamcmd-home',
			LOCALAPPDATA: join('C:/steamcmd-home', 'AppData', 'Local'),
			PATH: 'C:/Windows',
			USERPROFILE: 'C:/steamcmd-home',
		},
	)
})

test('SteamCMD spawn options do not override home by default', () => {
	const options = createSteamCmdSpawnOptions({ env: { HOME: '/root' } })

	expect(options.cwd).toBeUndefined()
	expect(options.env).toBeUndefined()
})

test('SteamCMD errors redact credentials', () => {
	expect(
		redactSteamCmdOutput('failed login steam-user steam-password', {
			username: 'steam-user',
			password: 'steam-password',
		}),
	).toBe('failed login [redacted] [redacted]')
})

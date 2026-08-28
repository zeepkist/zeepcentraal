import { expect, mock, spyOn, test } from 'bun:test'
import type { Client, GuildMember } from 'discord.js'
import { Events } from 'discord.js'
import { expectComponentsV2 } from '../test/components'
import { testConfig } from '../test/mocks'
import { createCommandRuntime } from './commands/context'
import { commandData } from './commands/registry'
import {
	createDiscordRuntime,
	createProductionDiscordDependencies,
	type DiscordRuntimeDependencies,
	main,
	registerCommands,
	runDiscordEntrypoint,
	runSelfTest,
	syncLinkedRole,
} from './runtime'

function workingBufferUtil() {
	return {
		mask(
			source: Uint8Array,
			mask: Uint8Array,
			output: Uint8Array,
			offset: number,
			length: number,
		) {
			for (let index = 0; index < length; index++) {
				output[offset + index] = (source[index] ?? 0) ^ (mask[index % 4] ?? 0)
			}
		},
		unmask(buffer: Uint8Array, mask: Uint8Array) {
			for (let index = 0; index < buffer.length; index++) {
				buffer[index] = (buffer[index] ?? 0) ^ (mask[index % 4] ?? 0)
			}
		},
	}
}

function createClientHarness() {
	const onceHandlers = new Map<string, (...args: never[]) => unknown>()
	const onHandlers = new Map<string, (...args: never[]) => unknown>()
	const destroy = mock(() => {})
	const login = mock(async () => 'token')
	const removeAllListeners = mock(() => {})
	const client = {
		destroy,
		guilds: { cache: new Map() },
		login,
		removeAllListeners,
		on: mock((event: string, listener: (...args: never[]) => unknown) => {
			onHandlers.set(event, listener)
			return client
		}),
		once: mock((event: string, listener: (...args: never[]) => unknown) => {
			onceHandlers.set(event, listener)
			return client
		}),
	} as unknown as Client
	return { client, destroy, login, onHandlers, onceHandlers }
}

function createDependencies(
	overrides: Partial<DiscordRuntimeDependencies> = {},
	clientHarness = createClientHarness(),
) {
	const backend = {
		guild: mock(
			async (_guildId: string): Promise<unknown> => ({
				config: null,
				feeds: [],
				digest: null,
				tournamentMessages: [],
			}),
		),
		user: mock(
			async (_discordId: string): Promise<unknown> => ({
				linkedUser: null,
				preference: null,
				watches: [],
			}),
		),
	}
	const graphql = { dispose: mock(() => {}) }
	const feeds = {
		start: mock(() => {}),
		stats: mock(() => ({ activityQueueDepth: 0 })),
		stop: mock(() => {}),
	}
	const rest = { put: mock(async (_route: string, _options: unknown) => ({})) }
	let healthOptions:
		| {
				fetch: (request: Request) => Response | Promise<Response>
				hostname: string
				port: number
		  }
		| undefined
	const health = { stop: mock(() => {}) }
	const signals = new Map<string, () => void>()
	const dependencies: DiscordRuntimeDependencies = {
		commandData: [{ name: 'help', description: 'Help', type: 1 }],
		createBackend: mock(() => backend) as never,
		createClient: mock(() => clientHarness.client),
		createCommandRuntime,
		createFeeds: mock(() => feeds) as never,
		createGraphql: mock(() => graphql) as never,
		createRest: mock(() => rest),
		deflate: (source) => source,
		dispatchAutocomplete: mock(async () => true),
		dispatchButton: mock(async () => true),
		dispatchChatInput: mock(async () => true),
		dispatchContextMenu: mock(async () => true),
		inflate: (source) => source,
		loadBufferUtil: mock(async () => workingBufferUtil()) as never,
		log: mock(() => {}),
		logError: mock(() => {}),
		onSignal: mock((signal, listener) => {
			signals.set(signal, listener)
		}),
		parseConfig: mock(() => testConfig),
		serve: mock((options) => {
			healthOptions = options
			return health
		}),
		waitForDependencies: mock(async () => true),
		...overrides,
	}
	return {
		backend,
		clientHarness,
		dependencies,
		feeds,
		graphql,
		health,
		healthOptions: () => healthOptions,
		rest,
		signals,
	}
}

test('self-test validates bufferutil, zlib, and unique command names', async () => {
	const harness = createDependencies()
	expect(await runSelfTest(harness.dependencies)).toEqual({
		ok: true,
		commands: 1,
		bufferutil: true,
		bunZlib: true,
	})
	expect(harness.dependencies.log).toHaveBeenCalledWith(
		JSON.stringify({ ok: true, commands: 1, bufferutil: true, bunZlib: true }),
	)
	await expect(
		runSelfTest(
			createDependencies({
				loadBufferUtil: mock(async () => ({ mask: null, unmask: null })) as never,
			}).dependencies,
		),
	).rejects.toThrow('bufferutil native module is unavailable')
	await expect(
		runSelfTest(
			createDependencies({
				loadBufferUtil: mock(async () => ({
					mask: mock(() => {}),
					unmask: mock(() => {}),
				})) as never,
			}).dependencies,
		),
	).rejects.toThrow('bufferutil mask round-trip failed')
	await expect(
		runSelfTest(createDependencies({ inflate: () => new Uint8Array([1]) }).dependencies),
	).rejects.toThrow('node:zlib round-trip failed')
	await expect(
		runSelfTest(
			createDependencies({
				commandData: [
					{ name: 'same', description: 'One', type: 1 },
					{ name: 'same', description: 'Two', type: 1 },
				],
			}).dependencies,
		),
	).rejects.toThrow('Duplicate Discord command name')
})

test('command registration supports disabled, guild, and global routes', async () => {
	const disabled = createDependencies()
	expect(
		await registerCommands({ ...testConfig, registerCommands: false }, disabled.dependencies),
	).toBe(false)
	expect(disabled.dependencies.createRest).not.toHaveBeenCalled()
	const guild = createDependencies()
	expect(
		await registerCommands(
			{ ...testConfig, developmentGuildId: 'guild-1' },
			guild.dependencies,
		),
	).toBe(true)
	expect(guild.rest.put.mock.calls[0]?.[0]).toContain('/guilds/guild-1/commands')
	expect(guild.rest.put.mock.calls[0]?.[1]).toEqual({ body: guild.dependencies.commandData })
	expect(guild.dependencies.log).toHaveBeenCalledWith(
		'Registered 1 Discord commands in guild guild-1',
	)
	const global = createDependencies()
	await registerCommands(testConfig, global.dependencies)
	expect(global.rest.put.mock.calls[0]?.[0]).not.toContain('/guilds/')
	expect(global.dependencies.log).toHaveBeenCalledWith('Registered 1 Discord commands globally')
})

test('linked-role sync adds and removes configured role only when needed', async () => {
	const add = mock(async () => {})
	const remove = mock(async () => {})
	const member = {
		id: 'discord-1',
		guild: { id: 'guild-1' },
		roles: { add, remove, cache: { has: mock(() => false) } },
	} as unknown as GuildMember
	const harness = createDependencies()
	const context = {
		backend: harness.backend,
	} as never
	await syncLinkedRole(member, context)
	expect(add).not.toHaveBeenCalled()
	harness.backend.guild.mockImplementation(async () => ({ config: { linkedRoleId: 'role-1' } }))
	harness.backend.user.mockImplementation(async () => ({ linkedUser: { id: 1 } }))
	await syncLinkedRole(member, context)
	expect(add).toHaveBeenCalledWith('role-1', 'ZeepCentraal account linked')
	member.roles.cache.has = mock(() => true)
	harness.backend.user.mockImplementation(async () => ({ linkedUser: null }))
	await syncLinkedRole(member, context)
	expect(remove).toHaveBeenCalledWith('role-1', 'ZeepCentraal account unlinked')
	harness.backend.user.mockImplementation(async () => ({ linkedUser: { id: 1 } }))
	await syncLinkedRole(member, context)
	expect(add).toHaveBeenCalledTimes(1)
})

test('runtime exposes starting/ready health, starts feeds, registers, and shuts down once', async () => {
	const harness = createDependencies()
	const runtime = createDiscordRuntime(testConfig, harness.dependencies)
	const options = harness.healthOptions()
	expect(options).toMatchObject({ hostname: '127.0.0.1', port: 6000 })
	let response = await options?.fetch(new Request('http://localhost/health'))
	expect(response?.status).toBe(503)
	expect(await response?.json()).toMatchObject({ status: 'starting', discord: false, guilds: 0 })
	response = await options?.fetch(new Request('http://localhost/other'))
	expect(response?.status).toBe(404)
	await runtime.start()
	expect(harness.dependencies.waitForDependencies).toHaveBeenCalledWith({
		config: testConfig,
		log: harness.dependencies.log,
		signal: expect.any(AbortSignal),
	})
	expect(harness.rest.put).toHaveBeenCalledTimes(1)
	expect(harness.clientHarness.login).toHaveBeenCalledWith('bot-token')
	expect(harness.signals.has('SIGINT')).toBe(true)
	expect(harness.signals.has('SIGTERM')).toBe(true)
	response = await options?.fetch(new Request('http://localhost/ready'))
	expect(response?.status).toBe(503)
	await harness.clientHarness.onceHandlers.get(Events.ClientReady)?.({
		user: { tag: 'ZeepCentraal#6919' },
		guilds: { cache: new Map([['guild', {}]]) },
	} as never)
	expect(harness.feeds.start).toHaveBeenCalledTimes(1)
	response = await options?.fetch(new Request('http://localhost/ready'))
	expect(response?.status).toBe(200)
	expect(await response?.json()).toMatchObject({ status: 'ok', discord: true })
	harness.signals.get('SIGINT')?.()
	harness.signals.get('SIGTERM')?.()
	await new Promise((resolve) => setTimeout(resolve, 0))
	await runtime.stop('test')
	await runtime.stop('again')
	expect(harness.feeds.stop).toHaveBeenCalledTimes(1)
	expect(harness.health.stop).toHaveBeenCalledWith(true)
	expect(harness.graphql.dispose).toHaveBeenCalledTimes(1)
	expect(harness.clientHarness.destroy).toHaveBeenCalledTimes(1)
})

test('runtime keeps commands and login gated until dependency preflight completes', async () => {
	let releaseReadiness!: (ready: boolean) => void
	const readiness = new Promise<boolean>((resolve) => {
		releaseReadiness = resolve
	})
	const harness = createDependencies({
		waitForDependencies: mock(async () => readiness),
	})
	const runtime = createDiscordRuntime(testConfig, harness.dependencies)
	const starting = runtime.start()
	await new Promise((resolve) => setTimeout(resolve, 0))

	expect(harness.signals.has('SIGINT')).toBe(true)
	expect(harness.signals.has('SIGTERM')).toBe(true)
	expect(harness.rest.put).not.toHaveBeenCalled()
	expect(harness.clientHarness.login).not.toHaveBeenCalled()
	const response = await harness.healthOptions()?.fetch(new Request('http://localhost/ready'))
	expect(response?.status).toBe(503)

	releaseReadiness(true)
	await starting
	expect(harness.rest.put).toHaveBeenCalledTimes(1)
	expect(harness.clientHarness.login).toHaveBeenCalledTimes(1)
})

test('runtime shutdown aborts dependency preflight and never starts Discord', async () => {
	const harness = createDependencies({
		waitForDependencies: mock(
			async ({ signal }) =>
				new Promise<boolean>((resolve) => {
					if (signal.aborted) {
						resolve(false)
						return
					}
					signal.addEventListener('abort', () => resolve(false), { once: true })
				}),
		),
	})
	const runtime = createDiscordRuntime(testConfig, harness.dependencies)
	const starting = runtime.start()
	await new Promise((resolve) => setTimeout(resolve, 0))
	harness.signals.get('SIGTERM')?.()
	await starting
	await new Promise((resolve) => setTimeout(resolve, 0))

	expect(harness.rest.put).not.toHaveBeenCalled()
	expect(harness.clientHarness.login).not.toHaveBeenCalled()
	expect(harness.feeds.stop).toHaveBeenCalledTimes(1)
	expect(harness.health.stop).toHaveBeenCalledWith(true)
	expect(harness.graphql.dispose).toHaveBeenCalledTimes(1)
	expect(harness.clientHarness.destroy).toHaveBeenCalledTimes(1)
	await harness.clientHarness.onceHandlers.get(Events.ClientReady)?.({
		user: { tag: 'ZeepCentraal#6919' },
		guilds: { cache: new Map() },
	} as never)
	expect(harness.feeds.start).not.toHaveBeenCalled()
})

test('main disposes runtime when startup fails', async () => {
	const harness = createDependencies({
		waitForDependencies: mock(async () => {
			throw new Error('preflight failed')
		}),
	})

	await expect(main({ dependencies: harness.dependencies })).rejects.toThrow('preflight failed')
	expect(harness.feeds.stop).toHaveBeenCalledTimes(1)
	expect(harness.health.stop).toHaveBeenCalledWith(true)
	expect(harness.graphql.dispose).toHaveBeenCalledTimes(1)
	expect(harness.clientHarness.destroy).toHaveBeenCalledTimes(1)
})

function interaction(kind: string, overrides: Record<string, unknown> = {}) {
	return {
		id: `${kind}-id`,
		commandName: kind,
		user: { id: 'discord-1' },
		deferred: false,
		replied: false,
		isAutocomplete: () => kind === 'autocomplete',
		isButton: () => kind === 'button',
		isUserContextMenuCommand: () => kind === 'context',
		isChatInputCommand: () => kind === 'chat',
		isRepliable: () => true,
		inGuild: () => false,
		reply: mock(async (_options: unknown) => {}),
		editReply: mock(async (_options: unknown) => {}),
		followUp: mock(async (_options: unknown) => {}),
		...overrides,
	}
}

test('runtime routes every interaction type and ignores unsupported interactions', async () => {
	const harness = createDependencies()
	createDiscordRuntime(testConfig, harness.dependencies)
	const handler = harness.clientHarness.onHandlers.get(Events.InteractionCreate)
	for (const kind of ['autocomplete', 'button', 'context', 'chat', 'other']) {
		await handler?.(interaction(kind) as never)
	}
	expect(harness.dependencies.dispatchAutocomplete).toHaveBeenCalledTimes(1)
	expect(harness.dependencies.dispatchButton).toHaveBeenCalledTimes(1)
	expect(harness.dependencies.dispatchContextMenu).toHaveBeenCalledTimes(1)
	expect(harness.dependencies.dispatchChatInput).toHaveBeenCalledTimes(1)
})

test('runtime resynchronizes linked roles after guild link and unlink commands', async () => {
	const harness = createDependencies()
	harness.backend.guild.mockImplementation(async () => ({ config: null }))
	createDiscordRuntime(testConfig, harness.dependencies)
	const fetch = mock(async () => ({
		id: 'discord-1',
		guild: { id: 'guild-1' },
		roles: {
			cache: { has: () => false },
			add: mock(async () => {}),
			remove: mock(async () => {}),
		},
	}))
	const handler = harness.clientHarness.onHandlers.get(Events.InteractionCreate)
	for (const commandName of ['link', 'unlink']) {
		await handler?.(
			interaction('chat', {
				commandName,
				inGuild: () => true,
				guild: { members: { fetch } },
			}) as never,
		)
	}
	expect(fetch).toHaveBeenCalledTimes(2)
	await handler?.(
		interaction('chat', {
			commandName: 'link',
			inGuild: () => true,
			guild: { members: { fetch: mock(async () => null) } },
		}) as never,
	)
})

test('runtime contains member sync failures and uses all Discord error response paths', async () => {
	const harness = createDependencies({
		dispatchChatInput: mock(async () => Promise.reject(new Error('request failed'))),
	})
	harness.backend.guild.mockImplementation(async () => Promise.reject(new Error('role failed')))
	createDiscordRuntime(testConfig, harness.dependencies)
	const memberHandler = harness.clientHarness.onHandlers.get(Events.GuildMemberAdd)
	memberHandler?.({ id: 'member', guild: { id: 'guild' } } as never)
	await new Promise((resolve) => setTimeout(resolve, 0))
	expect(harness.dependencies.logError).toHaveBeenCalledWith(
		'Linked role sync failed for member',
		{ message: 'role failed', name: 'Error' },
	)
	const handler = harness.clientHarness.onHandlers.get(Events.InteractionCreate)
	const edit = interaction('chat', { deferred: true })
	await handler?.(edit as never)
	expectComponentsV2(edit.editReply.mock.calls[0]?.[0])
	const follow = interaction('chat', { replied: true })
	await handler?.(follow as never)
	expectComponentsV2(follow.followUp.mock.calls[0]?.[0], true)
	const reply = interaction('chat')
	await handler?.(reply as never)
	expectComponentsV2(reply.reply.mock.calls[0]?.[0], true)
	const noReply = interaction('chat', { isRepliable: () => false })
	await handler?.(noReply as never)
	expect(noReply.reply).not.toHaveBeenCalled()
	harness.dependencies.dispatchChatInput = mock(async () => Promise.reject('unknown'))
	const unknown = interaction('chat')
	await handler?.(unknown as never)
	expect(JSON.stringify(unknown.reply.mock.calls[0]?.[0])).toContain('Unknown error')
})

test('main and entrypoint support self-test, injected env, normal startup, and import safety', async () => {
	const self = createDependencies()
	expect(
		await main({ argv: ['bun', 'index.ts', '--self-test'], dependencies: self.dependencies }),
	).toMatchObject({
		ok: true,
	})
	const normal = createDependencies()
	const env = { NODE_ENV: 'test' }
	const runtime = await main({
		argv: ['bun', 'index.ts'],
		dependencies: normal.dependencies,
		env,
	})
	expect(normal.dependencies.parseConfig).toHaveBeenCalledWith(env)
	expect(runtime).toMatchObject({ start: expect.any(Function), stop: expect.any(Function) })
	expect(normal.clientHarness.login).toHaveBeenCalledTimes(1)
	expect(await runDiscordEntrypoint(false, { dependencies: normal.dependencies })).toBeUndefined()
	const entrypoint = createDependencies()
	const running = runDiscordEntrypoint(true, {
		argv: ['bun', 'index.ts'],
		dependencies: entrypoint.dependencies,
	})
	await new Promise((resolve) => setTimeout(resolve, 0))
	expect(entrypoint.clientHarness.login).toHaveBeenCalledTimes(1)
	entrypoint.signals.get('SIGTERM')?.()
	await running
})

test('production dependency factory builds concrete adapters without external I/O', async () => {
	const consoleLog = spyOn(console, 'log').mockImplementation(() => {})
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const dependencies = createProductionDiscordDependencies()
	expect(dependencies.commandData).toBe(commandData)
	const backend = dependencies.createBackend(testConfig)
	expect(backend).toBeDefined()
	const client = dependencies.createClient()
	const graphql = dependencies.createGraphql(testConfig)
	expect(dependencies.createCommandRuntime()).toBeDefined()
	expect(dependencies.createFeeds(client, {} as never)).toBeDefined()
	expect(dependencies.createRest('token')).toBeDefined()
	expect(dependencies.waitForDependencies).toBeFunction()
	const compressed = dependencies.deflate(new TextEncoder().encode('test'))
	expect(new TextDecoder().decode(dependencies.inflate(compressed))).toBe('test')
	expect((await dependencies.loadBufferUtil()).mask).toBeFunction()
	dependencies.log('log')
	dependencies.logError('error')
	expect(consoleLog).toHaveBeenCalledWith('log')
	expect(consoleError).toHaveBeenCalledWith('error')
	const listener = mock(() => {})
	dependencies.onSignal('SIGTERM' as never, listener)
	process.off('SIGTERM' as never, listener)
	expect(
		dependencies.parseConfig({
			NODE_ENV: 'test',
			DISCORD_CLIENT_ID: 'client',
			DISCORD_BOT_TOKEN: 'bot',
			DISCORD_BOT_API_TOKEN: 'x'.repeat(32),
		}),
	).toMatchObject({ clientId: 'client', botToken: 'bot' })
	const server = dependencies.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () => new Response('ok'),
	})
	server.stop(true)
	graphql.dispose()
	client.destroy()
	consoleLog.mockRestore()
	consoleError.mockRestore()
})

test('runtime source and image use current Discord APIs, Bun zlib, and bufferutil', async () => {
	const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).json()
	expect(packageJson.dependencies['@discordjs/ws']).toBeUndefined()
	expect(packageJson.dependencies.bufferutil).toBe('~4.1.0')
	expect(packageJson.dependencies['zlib-sync']).toBeUndefined()
	const source = await Bun.file(new URL('runtime.ts', import.meta.url)).text()
	expect(source).toContain("from 'node:zlib'")
	expect(source).toContain('Events.ClientReady')
	expect(source).not.toContain("client.once('ready'")
	const dockerfile = await Bun.file(
		new URL('../../../Dockerfile.discord', import.meta.url),
	).text()
	expect(dockerfile).not.toContain('zlib_sync.node')
	expect(dockerfile).toContain('["./zeepcentraal-discord", "--self-test"]')
})

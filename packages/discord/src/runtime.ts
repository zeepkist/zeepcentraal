import { deflateSync, inflateSync } from 'node:zlib'
import { parseDiscordBotConfig } from '@zeepkist/core/config/discord-bot'
import {
	Client,
	Events,
	GatewayIntentBits,
	type GuildMember,
	Options,
	REST,
	type RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from 'discord.js'
import { DiscordBackendClient } from './backend'
import { type CommandContext, createCommandRuntime } from './commands/context'
import {
	commandData,
	dispatchAutocomplete,
	dispatchButton,
	dispatchChatInput,
	dispatchContextMenu,
} from './commands/registry'
import { editPayload, errorContainer, replyPayload } from './display'
import { discordErrorSummary } from './errors'
import { FeedService } from './feeds'
import { ZeepGraphqlClient } from './graphql'
import { waitForDiscordDependencies } from './readiness'
import type { DiscordBotConfig } from './types'

type BufferUtil = typeof import('bufferutil')

type RestClient = Pick<REST, 'put'>

type HealthServer = {
	stop: (closeActiveConnections?: boolean) => void
}

type HealthServerOptions = {
	fetch: (request: Request) => Response | Promise<Response>
	hostname: string
	port: number
}

export type DiscordRuntimeDependencies = {
	commandData: RESTPostAPIApplicationCommandsJSONBody[]
	createBackend: (config: DiscordBotConfig) => DiscordBackendClient
	createClient: () => Client
	createCommandRuntime: typeof createCommandRuntime
	createFeeds: (client: Client, context: CommandContext) => FeedService
	createGraphql: (config: DiscordBotConfig) => ZeepGraphqlClient
	createRest: (token: string) => RestClient
	deflate: (source: Uint8Array) => Uint8Array
	dispatchAutocomplete: typeof dispatchAutocomplete
	dispatchButton: typeof dispatchButton
	dispatchChatInput: typeof dispatchChatInput
	dispatchContextMenu: typeof dispatchContextMenu
	inflate: (source: Uint8Array) => Uint8Array
	loadBufferUtil: () => Promise<BufferUtil>
	log: (...values: unknown[]) => void
	logError: (...values: unknown[]) => void
	onSignal: (signal: 'SIGINT' | 'SIGTERM', listener: () => void) => void
	offSignal?: (signal: 'SIGINT' | 'SIGTERM', listener: () => void) => void
	parseConfig: (env: NodeJS.ProcessEnv) => DiscordBotConfig
	serve: (options: HealthServerOptions) => HealthServer
	waitForDependencies: typeof waitForDiscordDependencies
}

export function createProductionDiscordDependencies(): DiscordRuntimeDependencies {
	return {
		commandData,
		createBackend: (config) => new DiscordBackendClient(config),
		createClient: () =>
			new Client({
				intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
				makeCache: Options.cacheWithLimits({
					...Options.DefaultMakeCacheSettings,
					GuildMemberManager: {
						maxSize: 100,
						keepOverLimit: (member) => member.id === member.client.user?.id,
					},
					MessageManager: 0,
					PresenceManager: 0,
					ReactionManager: 0,
					ReactionUserManager: 0,
					StageInstanceManager: 0,
					ThreadMemberManager: 0,
					UserManager: 1_000,
					VoiceStateManager: 0,
				}),
			}),
		createCommandRuntime,
		createFeeds: (client, context) => new FeedService(client, context),
		createGraphql: (config) => new ZeepGraphqlClient(config),
		createRest: (token) => new REST({ version: '10' }).setToken(token),
		deflate: deflateSync,
		dispatchAutocomplete,
		dispatchButton,
		dispatchChatInput,
		dispatchContextMenu,
		inflate: inflateSync,
		loadBufferUtil: () => import('bufferutil'),
		log: (...values) => console.log(...values),
		logError: (...values) => console.error(...values),
		onSignal: (signal, listener) => process.on(signal as never, listener),
		offSignal: (signal, listener) => process.off(signal as never, listener),
		parseConfig: (env) => parseDiscordBotConfig(env) as DiscordBotConfig,
		serve: (options) => Bun.serve(options),
		waitForDependencies: waitForDiscordDependencies,
	}
}

export async function runSelfTest(
	dependencies: DiscordRuntimeDependencies = createProductionDiscordDependencies(),
) {
	const bufferutil = await dependencies.loadBufferUtil()
	if (typeof bufferutil.mask !== 'function' || typeof bufferutil.unmask !== 'function') {
		throw new Error('bufferutil native module is unavailable')
	}
	const source = Buffer.from('ZeepCentraal Discord compression self-test')
	const masked = Buffer.alloc(source.length)
	const mask = Buffer.from([0x12, 0x34, 0x56, 0x78])
	bufferutil.mask(source, mask, masked, 0, source.length)
	bufferutil.unmask(masked, mask)
	if (!masked.equals(source)) throw new Error('bufferutil mask round-trip failed')
	const inflated = Buffer.from(dependencies.inflate(dependencies.deflate(source)))
	if (!inflated.equals(source)) throw new Error('node:zlib round-trip failed')
	const names = dependencies.commandData.map((command) => command.name)
	if (new Set(names).size !== names.length) throw new Error('Duplicate Discord command name')
	const result = {
		ok: true,
		commands: dependencies.commandData.length,
		bufferutil: true,
		bunZlib: true,
	}
	dependencies.log(JSON.stringify(result))
	return result
}

export async function registerCommands(
	config: DiscordBotConfig,
	dependencies: DiscordRuntimeDependencies,
) {
	if (!config.registerCommands) return false
	const rest = dependencies.createRest(config.botToken)
	const route = config.developmentGuildId
		? Routes.applicationGuildCommands(config.clientId, config.developmentGuildId)
		: Routes.applicationCommands(config.clientId)
	await rest.put(route, { body: dependencies.commandData })
	dependencies.log(
		`Registered ${dependencies.commandData.length} Discord commands ${config.developmentGuildId ? `in guild ${config.developmentGuildId}` : 'globally'}`,
	)
	return true
}

export async function syncLinkedRole(member: GuildMember, context: CommandContext) {
	const state = await context.backend.guild(member.guild.id)
	const roleId = state.config?.linkedRoleId
	if (!roleId) return
	const linked = Boolean((await context.backend.user(member.id)).linkedUser)
	if (linked && !member.roles.cache.has(roleId)) {
		await member.roles.add(roleId, 'ZeepCentraal account linked')
	}
	if (!linked && member.roles.cache.has(roleId)) {
		await member.roles.remove(roleId, 'ZeepCentraal account unlinked')
	}
}

export type DiscordRuntime = {
	client: Client
	context: CommandContext
	start: () => Promise<void>
	stop: (signal: string) => Promise<void>
	closed: Promise<void>
	[Symbol.asyncDispose](): Promise<void>
}

export function createDiscordRuntime(
	config: DiscordBotConfig,
	dependencies: DiscordRuntimeDependencies = createProductionDiscordDependencies(),
): DiscordRuntime {
	const client = dependencies.createClient()
	const graphql = dependencies.createGraphql(config)
	const backend = dependencies.createBackend(config)
	const context: CommandContext = {
		backend,
		config,
		graphql,
		runtime: dependencies.createCommandRuntime(),
	}
	const feeds = dependencies.createFeeds(client, context)
	const startupController = new AbortController()
	let ready = false
	let stopping = false
	let resolveClosed!: () => void
	const closed = new Promise<void>((resolve) => {
		resolveClosed = resolve
	})
	const signalHandlers = new Map<'SIGINT' | 'SIGTERM', () => void>()
	let stopPromise: Promise<void> | undefined

	client.once(Events.ClientReady, (connected) => {
		if (stopping) return
		ready = true
		dependencies.log(
			`Discord connected as ${connected.user.tag} in ${connected.guilds.cache.size} guilds`,
		)
		feeds.start()
	})

	client.on(Events.GuildMemberAdd, (member) => {
		void syncLinkedRole(member, context).catch((error) => {
			dependencies.logError(
				`Linked role sync failed for ${member.id}`,
				discordErrorSummary(error),
			)
		})
	})

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			if (interaction.isAutocomplete()) {
				await dependencies.dispatchAutocomplete(interaction, context)
				return
			}
			if (interaction.isButton()) {
				await dependencies.dispatchButton(interaction, context)
				return
			}
			if (interaction.isUserContextMenuCommand()) {
				await dependencies.dispatchContextMenu(interaction, context)
				return
			}
			if (!interaction.isChatInputCommand()) return
			await dependencies.dispatchChatInput(interaction, context)
			if (
				(interaction.commandName === 'link' || interaction.commandName === 'unlink') &&
				interaction.inGuild()
			) {
				const member = await interaction.guild?.members.fetch(interaction.user.id)
				if (member) await syncLinkedRole(member, context)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			dependencies.logError(
				`Discord interaction ${interaction.id} failed`,
				discordErrorSummary(error),
			)
			if (!interaction.isRepliable()) return
			const container = errorContainer(message)
			if (interaction.deferred) await interaction.editReply(editPayload(container))
			else if (interaction.replied)
				await interaction.followUp(replyPayload(container, { ephemeral: true }))
			else await interaction.reply(replyPayload(container, { ephemeral: true }))
		}
	})

	const healthServer = dependencies.serve({
		hostname: config.health.host,
		port: config.health.port,
		fetch(request) {
			const path = new URL(request.url).pathname
			if (path !== '/health' && path !== '/ready') {
				return new Response('Not found', { status: 404 })
			}
			return Response.json(
				{
					status: ready ? 'ok' : 'starting',
					discord: ready,
					guilds: client.guilds.cache.size,
					memory: process.memoryUsage(),
					queues: feeds.stats(),
					sessions: context.runtime.sessions.stats(),
				},
				{ status: ready ? 200 : 503 },
			)
		},
	})

	const stop = async (signal: string) => {
		if (stopPromise) return stopPromise
		stopping = true
		stopPromise = (async () => {
			dependencies.log(`Received ${signal}; stopping Discord bot`)
			startupController.abort()
			ready = false
			for (const [registeredSignal, listener] of signalHandlers) {
				dependencies.offSignal?.(registeredSignal, listener)
			}
			signalHandlers.clear()
			try {
				await feeds.stop()
			} finally {
				healthServer.stop(true)
				graphql.dispose()
				context.runtime.sessions[Symbol.dispose]()
				client.removeAllListeners()
				client.destroy()
				resolveClosed()
			}
		})()
		return stopPromise
	}

	const start = async () => {
		for (const signal of ['SIGINT', 'SIGTERM'] as const) {
			const listener = () => void stop(signal)
			signalHandlers.set(signal, listener)
			dependencies.onSignal(signal, listener)
		}
		const dependenciesReady = await dependencies.waitForDependencies({
			config,
			log: dependencies.log,
			signal: startupController.signal,
		})
		if (!dependenciesReady || stopping) return
		await registerCommands(config, dependencies)
		if (stopping) return
		await client.login(config.botToken)
	}

	return {
		client,
		context,
		start,
		stop,
		closed,
		[Symbol.asyncDispose]() {
			return stop('dispose')
		},
	}
}

export type DiscordMainOptions = {
	argv?: string[]
	dependencies?: DiscordRuntimeDependencies
	env?: NodeJS.ProcessEnv
}

export async function main(options: DiscordMainOptions = {}) {
	const dependencies = options.dependencies ?? createProductionDiscordDependencies()
	const argv = options.argv ?? process.argv
	if (argv.includes('--self-test')) return runSelfTest(dependencies)
	const config = dependencies.parseConfig(options.env ?? process.env)
	const runtime = createDiscordRuntime(config, dependencies)
	try {
		await runtime.start()
		return runtime
	} catch (error) {
		await runtime.stop('startup failure')
		throw error
	}
}

export async function runDiscordEntrypoint(isMain: boolean, options?: DiscordMainOptions) {
	if (!isMain) return
	const result = await main(options)
	if (!result || !('closed' in result)) return result
	await using runtime = result
	await runtime.closed
}

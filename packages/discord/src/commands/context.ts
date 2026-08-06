import type { DiscordBackendClient } from '../backend'
import type { ZeepGraphqlClient } from '../graphql'
import type { DiscordBotConfig } from '../types'
import { CommandSessionStore } from './utils/session-store'

export type BotContext = {
	backend: DiscordBackendClient
	config: DiscordBotConfig
	graphql: ZeepGraphqlClient
}

export type CommandRuntime = {
	monotonicNow: () => number
	now: () => Date
	random: () => number
	sessions: CommandSessionStore
}

export type CommandContext = BotContext & {
	runtime: CommandRuntime
}

export type CommandRuntimeOptions = Partial<Omit<CommandRuntime, 'sessions'>> & {
	id?: () => string
	sessions?: CommandSessionStore
}

export function createCommandRuntime(options: CommandRuntimeOptions = {}): CommandRuntime {
	const now = options.now ?? (() => new Date())
	const id = options.id ?? (() => crypto.randomUUID())
	return {
		monotonicNow: options.monotonicNow ?? (() => performance.now()),
		now,
		random: options.random ?? Math.random,
		sessions:
			options.sessions ??
			new CommandSessionStore({
				id,
				now: () => now().getTime(),
			}),
	}
}

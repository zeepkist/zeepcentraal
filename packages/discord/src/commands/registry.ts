import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	UserContextMenuCommandInteraction,
} from 'discord.js'
import { botStatusDefinition, botStatusHandler } from './bot-status'
import { compareDefinition, compareHandler } from './compare'
import type { CommandContext } from './context'
import { feedDefinition, feedHandler } from './feed'
import { gtrDefinition, gtrHandler } from './gtr'
import { helpDefinition, helpHandler } from './help'
import { levelAutocompleteHandler, levelDefinition, levelHandler } from './level'
import { linkDefinition, linkHandler } from './link'
// import { linkedRoleDefinition, linkedRoleHandler } from './linked-role'
import { modkistDefinition, modkistHandler } from './modkist'
import { playlistDefinition, playlistHandler } from './playlist'
import { playlistRecommendDefinition, playlistRecommendHandler } from './playlist-recommend'
import { randomLevelDefinition, randomLevelHandler } from './random-level'
import { statsDefinition, statsHandler } from './stats'
import { statsSurfaceDefinition, statsSurfaceHandler } from './stats-surface'
import { totmDefinition, totmHandler } from './totm'
import { totwDefinition, totwHandler } from './totw'
import { unlinkDefinition, unlinkHandler } from './unlink'
import { userDefinition, userHandler } from './user'
import { handleButton } from './utils/button.handler'
// import { watchDefinition, watchHandler } from './watch'
import { wrPingDefinition, wrPingHandler } from './wr-ping'
import { zeepCentraalProfileDefinition, zeepCentraalProfileHandler } from './zeepcentraal-profile'

// import { zslDefinition, zslHandler } from './zsl'

type Definition = {
	toJSON: () => RESTPostAPIApplicationCommandsJSONBody
}

export type ChatInputHandler = (
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) => Promise<unknown>

export type AutocompleteHandler = (
	interaction: AutocompleteInteraction,
	context: CommandContext,
) => Promise<unknown>

export type ContextMenuHandler = (
	interaction: UserContextMenuCommandInteraction,
	context: CommandContext,
) => Promise<unknown>

export type ChatInputCommandEntry = {
	autocomplete?: AutocompleteHandler
	definition: Definition
	handler: ChatInputHandler
}

export type ContextMenuCommandEntry = {
	definition: Definition
	handler: ContextMenuHandler
}

export type CommandRegistry = {
	autocompleteHandlers: ReadonlyMap<string, AutocompleteHandler>
	chatInputHandlers: ReadonlyMap<string, ChatInputHandler>
	commandData: RESTPostAPIApplicationCommandsJSONBody[]
	contextMenuHandlers: ReadonlyMap<string, ContextMenuHandler>
}

export const chatInputCommands: ChatInputCommandEntry[] = [
	{ definition: linkDefinition, handler: linkHandler },
	{ definition: unlinkDefinition, handler: unlinkHandler },
	{ definition: wrPingDefinition, handler: wrPingHandler },
	{ definition: feedDefinition, handler: feedHandler },
	// { definition: linkedRoleDefinition, handler: linkedRoleHandler },
	// { definition: watchDefinition, handler: watchHandler },
	{ definition: levelDefinition, handler: levelHandler, autocomplete: levelAutocompleteHandler },
	{ definition: userDefinition, handler: userHandler },
	{ definition: totwDefinition, handler: totwHandler },
	{ definition: totmDefinition, handler: totmHandler },
	// { definition: zslDefinition, handler: zslHandler },
	{ definition: playlistDefinition, handler: playlistHandler },
	{ definition: playlistRecommendDefinition, handler: playlistRecommendHandler },
	{ definition: statsDefinition, handler: statsHandler },
	{ definition: statsSurfaceDefinition, handler: statsSurfaceHandler },
	{ definition: modkistDefinition, handler: modkistHandler },
	{ definition: gtrDefinition, handler: gtrHandler },
	{ definition: compareDefinition, handler: compareHandler },
	{ definition: randomLevelDefinition, handler: randomLevelHandler },
	{ definition: helpDefinition, handler: helpHandler },
	{ definition: botStatusDefinition, handler: botStatusHandler },
]

export const contextMenuCommands: ContextMenuCommandEntry[] = [
	{ definition: zeepCentraalProfileDefinition, handler: zeepCentraalProfileHandler },
]

export function createCommandRegistry(
	chatEntries: ChatInputCommandEntry[] = chatInputCommands,
	contextEntries: ContextMenuCommandEntry[] = contextMenuCommands,
): CommandRegistry {
	const commandData: RESTPostAPIApplicationCommandsJSONBody[] = []
	const chatInputHandlers = new Map<string, ChatInputHandler>()
	const autocompleteHandlers = new Map<string, AutocompleteHandler>()
	const contextMenuHandlers = new Map<string, ContextMenuHandler>()
	const names = new Set<string>()
	for (const entry of chatEntries) {
		const data = entry.definition.toJSON()
		if (names.has(data.name)) throw new Error(`Duplicate Discord command name: ${data.name}`)
		if (typeof entry.handler !== 'function') {
			throw new Error(`Missing Discord command handler: ${data.name}`)
		}
		names.add(data.name)
		commandData.push(data)
		chatInputHandlers.set(data.name, entry.handler)
		if (entry.autocomplete) autocompleteHandlers.set(data.name, entry.autocomplete)
	}
	for (const entry of contextEntries) {
		const data = entry.definition.toJSON()
		if (names.has(data.name)) throw new Error(`Duplicate Discord command name: ${data.name}`)
		if (typeof entry.handler !== 'function') {
			throw new Error(`Missing Discord command handler: ${data.name}`)
		}
		names.add(data.name)
		commandData.push(data)
		contextMenuHandlers.set(data.name, entry.handler)
	}
	return { autocompleteHandlers, chatInputHandlers, commandData, contextMenuHandlers }
}

export const commandRegistry = createCommandRegistry()
export const commandData = commandRegistry.commandData

export async function dispatchChatInput(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	context.runtime.sessions.cleanup()
	const handler = commandRegistry.chatInputHandlers.get(interaction.commandName)
	if (!handler) throw new Error('Unknown command.')
	return handler(interaction, context)
}

export async function dispatchAutocomplete(
	interaction: AutocompleteInteraction,
	context: CommandContext,
) {
	const handler = commandRegistry.autocompleteHandlers.get(interaction.commandName)
	if (!handler) return false
	await handler(interaction, context)
	return true
}

export async function dispatchContextMenu(
	interaction: UserContextMenuCommandInteraction,
	context: CommandContext,
) {
	const handler = commandRegistry.contextMenuHandlers.get(interaction.commandName)
	if (!handler) throw new Error('Unknown context command.')
	return handler(interaction, context)
}

export const dispatchButton = handleButton

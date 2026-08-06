import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	UserContextMenuCommandInteraction,
} from 'discord.js'
import { botStatusDefinition } from './bot-status.definition'
import { handleBotStatus } from './bot-status.handler'
import { compareDefinition } from './compare.definition'
import { handleCompare } from './compare.handler'
import type { CommandContext } from './context'
import { feedDefinition } from './feed.definition'
import { handleFeed } from './feed.handler'
import { gtrDefinition } from './gtr.definition'
import { handleGtr } from './gtr.handler'
import { helpDefinition } from './help.definition'
import { handleHelp } from './help.handler'
import { levelDefinition } from './level.definition'
import { autocompleteLevel, handleLevel } from './level.handler'
import { linkDefinition } from './link.definition'
import { handleLink } from './link.handler'
// import { linkedRoleDefinition } from './linked-role.definition'
// import { handleLinkedRole } from './linked-role.handler'
import { modkistDefinition } from './modkist.definition'
import { handleModkist } from './modkist.handler'
import { playlistDefinition } from './playlist.definition'
import { handlePlaylist } from './playlist.handler'
import { playlistRecommendDefinition } from './playlist-recommend.definition'
import { handlePlaylistRecommend } from './playlist-recommend.handler'
import { randomLevelDefinition } from './random-level.definition'
import { handleRandomLevel } from './random-level.handler'
import { statsDefinition } from './stats.definition'
import { handleStats } from './stats.handler'
import { statsSurfaceDefinition } from './stats-surface.definition'
import { handleStatsSurface } from './stats-surface.handler'
import { totmDefinition } from './totm.definition'
import { handleTotm } from './totm.handler'
import { totwDefinition } from './totw.definition'
import { handleTotw } from './totw.handler'
import { unlinkDefinition } from './unlink.definition'
import { handleUnlink } from './unlink.handler'
import { userDefinition } from './user.definition'
import { handleUser } from './user.handler'
import { handleButton } from './utils/button.handler'
// import { watchDefinition } from './watch.definition'
// import { handleWatch } from './watch.handler'
import { wrPingDefinition } from './wr-ping.definition'
import { handleWrPing } from './wr-ping.handler'
import { zeepCentraalProfileDefinition } from './zeepcentraal-profile.definition'
import { handleZeepCentraalProfile } from './zeepcentraal-profile.handler'

// import { zslDefinition } from './zsl.definition'
// import { handleZsl } from './zsl.handler'

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
	{ definition: linkDefinition, handler: handleLink },
	{ definition: unlinkDefinition, handler: handleUnlink },
	{ definition: wrPingDefinition, handler: handleWrPing },
	{ definition: feedDefinition, handler: handleFeed },
	// { definition: linkedRoleDefinition, handler: handleLinkedRole },
	// { definition: watchDefinition, handler: handleWatch },
	{ definition: levelDefinition, handler: handleLevel, autocomplete: autocompleteLevel },
	{ definition: userDefinition, handler: handleUser },
	{ definition: totwDefinition, handler: handleTotw },
	{ definition: totmDefinition, handler: handleTotm },
	// { definition: zslDefinition, handler: handleZsl },
	{ definition: playlistDefinition, handler: handlePlaylist },
	{ definition: playlistRecommendDefinition, handler: handlePlaylistRecommend },
	{ definition: statsDefinition, handler: handleStats },
	{ definition: statsSurfaceDefinition, handler: handleStatsSurface },
	{ definition: modkistDefinition, handler: handleModkist },
	{ definition: gtrDefinition, handler: handleGtr },
	{ definition: compareDefinition, handler: handleCompare },
	{ definition: randomLevelDefinition, handler: handleRandomLevel },
	{ definition: helpDefinition, handler: handleHelp },
	{ definition: botStatusDefinition, handler: handleBotStatus },
]

export const contextMenuCommands: ContextMenuCommandEntry[] = [
	{ definition: zeepCentraalProfileDefinition, handler: handleZeepCentraalProfile },
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

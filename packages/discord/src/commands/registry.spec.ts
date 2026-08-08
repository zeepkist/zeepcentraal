import { expect, mock, test } from 'bun:test'
import { ApplicationCommandType, PermissionFlagsBits } from 'discord.js'
import {
	createAutocompleteInteraction,
	createButtonInteraction,
	createChatInteraction,
	createContextInteraction,
	createMockContext,
	linkedUser,
} from '../../test/mocks'
import {
	chatInputCommands,
	commandData,
	contextMenuCommands,
	createCommandRegistry,
	dispatchAutocomplete,
	dispatchButton,
	dispatchChatInput,
	dispatchContextMenu,
} from './registry'

const expectedOptions: Record<string, string[]> = {
	link: ['code'],
	unlink: [],
	'wr-ping': ['enabled'],
	feed: ['kind', 'channel', 'enabled'],
	'linked-role': ['role'],
	watch: ['add', 'list', 'remove'],
	level: ['query'],
	user: ['discord', 'id'],
	totw: [],
	totm: [],
	zsl: ['scope', 'id', 'round'],
	playlist: ['count', 'sort', 'without-wr', 'without-pb', 'no-records', 'name'],
	'playlist-recommend': ['count'],
	stats: ['range', 'from', 'to'],
	'stats-surface': ['range', 'from', 'to'],
	modkist: [],
	gtr: [],
	compare: ['player'],
	'random-level': ['minimum-points'],
	help: [],
	'bot-status': [],
	'ZeepCentraal profile': [],
}

const linkCommand = chatInputCommands[0]
const profileCommand = contextMenuCommands[0]
if (!linkCommand || !profileCommand) throw new Error('Expected command fixtures are missing')

test('registry contains exact command set and option order', () => {
	expect(commandData).toHaveLength(20)
	expect(new Set(commandData.map((command) => command.name)).size).toBe(20)
	for (const command of commandData) {
		expect(command.options?.map((option) => option.name) ?? []).toEqual(
			expectedOptions[command.name] ?? [],
		)
	}
	const feed = commandData.find((command) => command.name === 'feed')
	// const linkedRole = commandData.find((command) => command.name === 'linked-role')
	const profile = commandData.find((command) => command.name === 'ZeepCentraal profile')
	expect(feed?.default_member_permissions).toBe(String(PermissionFlagsBits.ManageGuild))
	// expect(linkedRole?.default_member_permissions).toBe(String(PermissionFlagsBits.ManageRoles))
	expect(profile?.type).toBe(ApplicationCommandType.User)
})

test('registry rejects duplicate and missing chat handlers', () => {
	expect(() => createCommandRegistry([linkCommand, linkCommand], [])).toThrow(
		'Duplicate Discord command name: link',
	)
	expect(() =>
		createCommandRegistry([{ ...linkCommand, handler: undefined as never }], []),
	).toThrow('Missing Discord command handler: link')
})

test('registry rejects duplicate and missing context handlers', () => {
	expect(() =>
		createCommandRegistry(
			[linkCommand],
			[{ ...profileCommand, definition: linkCommand.definition }],
		),
	).toThrow('Duplicate Discord command name: link')
	expect(() =>
		createCommandRegistry([], [{ ...profileCommand, handler: undefined as never }]),
	).toThrow('Missing Discord command handler: ZeepCentraal profile')
})

test('registry dispatches chat input and rejects unknown commands', async () => {
	const { context } = createMockContext()
	const help = createChatInteraction('help')
	await dispatchChatInput(help.interaction, context)
	expect(JSON.stringify(help.state.reply)).toContain('ZeepCentraal bot')
	const unknown = createChatInteraction('unknown')
	expect(dispatchChatInput(unknown.interaction, context)).rejects.toThrow('Unknown command.')
})

test('registry dispatches and ignores autocomplete appropriately', async () => {
	const { context } = createMockContext()
	const level = createAutocompleteInteraction('level', 'a')
	expect(await dispatchAutocomplete(level.interaction, context)).toBe(true)
	expect(level.response()).toEqual([])
	const unknown = createAutocompleteInteraction('unknown', 'value')
	expect(await dispatchAutocomplete(unknown.interaction, context)).toBe(false)
})

test('registry dispatches context menu and button interactions', async () => {
	const userByFilter = mock(async () => linkedUser)
	const { context } = createMockContext({ graphql: { userByFilter } })
	const profile = createContextInteraction()
	await dispatchContextMenu(profile.interaction, context)
	expect(profile.state.edit).toBeDefined()
	const unknown = createContextInteraction('Unknown profile')
	expect(dispatchContextMenu(unknown.interaction, context)).rejects.toThrow(
		'Unknown context command.',
	)
	expect(await dispatchButton(createButtonInteraction('unknown:id').interaction, context)).toBe(
		false,
	)
})

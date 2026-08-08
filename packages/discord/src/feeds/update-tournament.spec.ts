import { expect, mock, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { createFeedGuild, createFeedGuildState, tournamentData } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { buildTournamentMessage } from '../commands/utils/tournament'
import { updateTournament } from './update-tournament'

test('tournament updates create, edit, skip stable, and reject invalid channels', async () => {
	const baseState = createFeedGuildState({
		feeds: [{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const query = mock(async () => tournamentData)
	const { context, backend } = createMockContext({
		graphql: { query },
	})
	const snapshot = await buildTournamentMessage(0, context)
	const created = createFeedGuild()
	await updateTournament(created.guild, baseState, 0, snapshot, context)
	expect(created.send).toHaveBeenCalledTimes(1)
	expect(backend.setTournamentMessage).toHaveBeenCalledWith(
		expect.objectContaining({ tournamentId: 5, messageId: 'message-new' }),
	)
	const saved = backend.setTournamentMessage.mock.calls[0]?.[0] as { contentHash: string }
	await updateTournament(
		created.guild,
		createFeedGuildState({
			...baseState,
			tournamentMessages: [
				{ idTournament: 5, channelId: 'channel', messageId: 'message-old', ...saved },
			],
		}),
		0,
		snapshot,
		context,
	)
	expect(created.send).toHaveBeenCalledTimes(1)
	const changed = createFeedGuildState({
		...baseState,
		tournamentMessages: [
			{ idTournament: 5, channelId: 'channel', messageId: 'message-old', contentHash: 'old' },
		],
	})
	await updateTournament(created.guild, changed, 0, snapshot, context)
	expect(created.edit).toHaveBeenCalledTimes(1)
	expect((created.edit.mock.calls as unknown[][])[0]?.[0]).toMatchObject({
		content: null,
		embeds: [],
		flags: MessageFlags.IsComponentsV2,
	})
	const invalid = createFeedGuild({ channel: { isTextBased: () => false } })
	await expect(updateTournament(invalid.guild, changed, 0, snapshot, context)).rejects.toThrow(
		'Configured tournament channel is unavailable',
	)
	await updateTournament(created.guild, createFeedGuildState(), 0, snapshot, context)
	expect(query).toHaveBeenCalledTimes(1)
})

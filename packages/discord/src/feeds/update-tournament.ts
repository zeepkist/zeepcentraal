import type { Guild, GuildTextBasedChannel } from 'discord.js'
import type { CommandContext } from '../commands/context'
import type { BuiltTournamentMessage } from '../commands/utils/tournament'
import { messageEditPayload } from '../display'
import type { DiscordGuildState } from '../types'
import { sendToChannel } from './send-to-channel'

export async function updateTournament(
	guild: Guild,
	state: DiscordGuildState,
	type: 0 | 1,
	snapshot: BuiltTournamentMessage,
	context: CommandContext,
) {
	const kind = type === 0 ? 'totw' : 'totm'
	const feed = state.feeds.find((entry) => entry.kind === kind && entry.enabled)
	if (!feed) return
	const existing = state.tournamentMessages?.find(
		(message) => message.idTournament === snapshot.tournamentId,
	)
	if (existing?.contentHash === snapshot.contentHash && existing.channelId === feed.channelId)
		return
	let messageId: string
	if (existing && existing.channelId === feed.channelId) {
		const channel = await guild.channels.fetch(feed.channelId)
		if (!channel?.isTextBased() || !('messages' in channel)) {
			throw new Error('Configured tournament channel is unavailable')
		}
		const message = await (channel as GuildTextBasedChannel).messages.fetch(existing.messageId)
		await message.edit(messageEditPayload(snapshot.container, { clearLegacy: true }))
		messageId = message.id
	} else {
		messageId = (await sendToChannel(guild, feed.channelId, snapshot.message)).id
	}
	await context.backend.setTournamentMessage({
		guildId: guild.id,
		tournamentId: snapshot.tournamentId,
		channelId: feed.channelId,
		messageId,
		contentHash: snapshot.contentHash,
	})
}

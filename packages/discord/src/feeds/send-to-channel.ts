import type { Guild, GuildTextBasedChannel, MessageCreateOptions } from 'discord.js'

export async function sendToChannel(
	guild: Guild,
	channelId: string,
	message: MessageCreateOptions,
): Promise<{ id: string }> {
	const channel = await guild.channels.fetch(channelId)
	if (!channel?.isTextBased() || !('send' in channel))
		throw new Error('Configured channel is unavailable')
	return (channel as GuildTextBasedChannel).send(message)
}

import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
} from 'discord.js'
import { displayContainer, editPayload, replyPayload } from '../../display'
import { truncate } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'

const PLAYLIST_PATH = '%AppData%\\Zeepkist\\Playlists'

export type PlaylistLevel = {
	id: number
	levelItems?: {
		nodes: Array<{
			createdAt?: string
			fileAuthor?: string
			fileUid?: string
			name: string
			updatedAt?: string
			workshopId?: bigint | number | string | null
		}>
	}
	levelPoints?: { points: number; rating: number } | null
	personalBestGlobals?: { totalCount: number }
	records?: { totalCount: number }
	worldRecordGlobal?: { record?: { time: number } | null; user?: LinkedUser | null } | null
	xxHash: string
}

export function createPlaylist(name: string, levels: PlaylistLevel[]) {
	return {
		name,
		amountOfLevels: levels.length,
		roundLength: 720,
		shufflePlaylist: true,
		UID: [],
		levels: levels.map((level) => {
			const item = level.levelItems?.nodes[0]
			return {
				UID: item?.fileUid ?? level.xxHash,
				WorkshopID: String(item?.workshopId ?? '-1'),
				Name: item?.name ?? level.xxHash,
				Author: item?.fileAuthor ?? 'Unknown',
			}
		}),
	}
}

export function playlistResponse(
	context: CommandContext,
	ownerId: string,
	name: string,
	levels: PlaylistLevel[],
	filters: string[],
) {
	if (levels.length === 0) throw new Error('No public levels matched these filters.')
	const slug = `${name}-${filters.join('-')}-${context.runtime.now().toISOString().slice(0, 10)}`
		.toLowerCase()
		.replaceAll(/[^a-z0-9-]+/g, '-')
		.replaceAll(/-+/g, '-')
	const filename = `${slug}.zeeplist`
	const content = `${JSON.stringify(createPlaylist(name, levels), null, 2)}\n`
	const id = context.runtime.sessions.createPlaylist(ownerId, filename, content)
	const list = levels
		.slice(0, 15)
		.map((level, index) => `${index + 1}. ${level.levelItems?.nodes[0]?.name ?? level.xxHash}`)
		.join('\n')
	return editPayload(
		displayContainer({
			actions: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`playlist:${id}`)
						.setLabel('Generate Playlist')
						.setStyle(ButtonStyle.Primary),
				),
			],
			description: `${levels.length} public levels matched.`,
			sections: [
				{ content: truncate(list, 3000), heading: 'Preview' },
				{
					content: `**Filters**  ${filters.join(', ') || 'None'}\n**Install**  Place downloaded file in \`${PLAYLIST_PATH}\`.`,
					heading: 'Playlist details',
				},
			],
			title: name,
		}),
	)
}

export async function playlistHandler(
	interaction: ButtonInteraction,
	context: CommandContext,
	id: string,
) {
	const session = context.runtime.sessions.playlist(id)
	if (!session) {
		await interaction.reply(
			replyPayload(
				displayContainer({
					description: 'Run command again.',
					title: 'Playlist download expired',
				}),
				{ ephemeral: true },
			),
		)
		return true
	}
	if (session.ownerId !== interaction.user.id) {
		await interaction.reply(
			replyPayload(
				displayContainer({
					description: 'Only command owner can download this playlist.',
					title: 'Private download',
				}),
				{ ephemeral: true },
			),
		)
		return true
	}
	await interaction.reply(
		replyPayload(
			displayContainer({
				description: `Place file in \`${PLAYLIST_PATH}\`.`,
				files: [{ name: session.filename }],
				title: 'Playlist ready',
			}),
			{
				ephemeral: true,
				files: [
					new AttachmentBuilder(Buffer.from(session.content), { name: session.filename }),
				],
			},
		),
	)
	return true
}

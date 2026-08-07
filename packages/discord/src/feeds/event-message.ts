import type { MessageCreateOptions } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { baseEmbed, compactNumber, formatTime, playerLabel, safeMentions } from '../format'
import type { DiscordActivityEvent } from '../types'
import { eventLevelName } from './event-level-name'
import { rankMessage } from './rank-message'

function eventLevelUrl(event: DiscordActivityEvent, context: CommandContext) {
	return event.level
		? `${context.config.frontendUrl}/level/${event.level.xxHash}`
		: context.config.frontendUrl
}

function assertNever(value: never): never {
	throw new Error(`Unsupported Discord activity event kind: ${String(value)}`)
}

export async function rankEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return rankMessage(event, context)
}

export function workshopEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	const item = event.level?.levelItems.nodes[0]
	return {
		embeds: [
			{
				...baseEmbed(
					'New public workshop level',
					`${eventLevelName(event)}\nBy ${playerLabel(item?.author)}`,
				),
				url: eventLevelUrl(event, context),
				thumbnail: item?.imageUrl ? { url: item.imageUrl } : undefined,
				fields: [
					{
						name: 'Workshop ID',
						value: String(item?.workshopId ?? event.payload?.workshopId ?? 'Unknown'),
					},
				],
			},
		],
		allowedMentions: safeMentions,
	} satisfies MessageCreateOptions
}

export function personalBestEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return {
		embeds: [
			{
				...baseEmbed(
					`New personal best • ${eventLevelName(event)}`,
					`${playerLabel(event.user)} • ${formatTime(event.record?.time)}`,
				),
				url: eventLevelUrl(event, context),
			},
		],
		allowedMentions: safeMentions,
	} satisfies MessageCreateOptions
}

export function voteEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return {
		embeds: [
			{
				...baseEmbed(
					`Level vote • ${eventLevelName(event)}`,
					`${playerLabel(event.user)} voted ${String(event.payload?.value ?? 'unknown')}.`,
				),
				url: eventLevelUrl(event, context),
			},
		],
		allowedMentions: safeMentions,
	} satisfies MessageCreateOptions
}

export async function worldRecordEventMessage(
	event: DiscordActivityEvent,
	context: CommandContext,
) {
	const samePlayer = event.userId !== null && event.userId === event.previousUserId
	const levelItem = event.level?.levelItems.nodes[0]
	let recordContext: string
	if (!event.previousRecord) {
		recordContext = 'First record set on this level.'
	} else if (samePlayer) {
		const improvement = event.record
			? `${(event.previousRecord.time - event.record.time).toFixed(3)}s`
			: 'an unknown amount'
		recordContext = `Improved by ${improvement}`
	} else {
		recordContext = `Stolen from ${playerLabel(event.previousUser)} (${formatTime(event.previousRecord.time)})`
	}
	const content =
		event.previousRecord && !samePlayer ? event.previousUser?.discordId?.toString() : undefined
	const preference = content ? await context.backend.user(content).catch(() => null) : null
	const shouldPing = Boolean(
		content && content !== '-1' && preference?.preference?.pingOnWorldRecordLoss,
	)

	return {
		content: shouldPing ? `<@${content}> your world record was beaten.` : undefined,
		embeds: [
			{
				...baseEmbed(
					`New world record • ${eventLevelName(event)}`,
					`${playerLabel(event.user)} • ${formatTime(event.record?.time)}\n${recordContext}`,
				),
				url: eventLevelUrl(event, context),
				thumbnail: levelItem?.imageUrl ? { url: levelItem.imageUrl } : undefined,
				fields: [
					{
						name: 'Ranked points',
						value: compactNumber(event.level?.levelPoints?.points),
						inline: true,
					},
					{
						name: 'Personal bests',
						value: compactNumber(event.level?.personalBestGlobals.totalCount),
						inline: true,
					},
				],
			},
		],
		allowedMentions: shouldPing ? { users: [content as string], parse: [] } : safeMentions,
	} satisfies MessageCreateOptions
}

export async function eventMessage(event: DiscordActivityEvent, context: CommandContext) {
	switch (event.kind) {
		case 'rank_batch':
			return rankEventMessage(event, context)
		case 'workshop':
			return workshopEventMessage(event, context)
		case 'personal_best':
			return personalBestEventMessage(event, context)
		case 'vote':
			return voteEventMessage(event, context)
		case 'world_record':
			return worldRecordEventMessage(event, context)
		default:
			return assertNever(event.kind)
	}
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type MessageCreateOptions } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { displayContainer, INFO_COLOR, messagePayload, SUCCESS_COLOR } from '../display'
import { compactNumber, formatTime, playerLabel, safeMentions } from '../format'
import type { DiscordActivityEvent } from '../types'
import { eventLevelName } from './event-level-name'
import { rankMessage } from './rank-message'

type EventMessageOptions = {
	includeLossPing?: boolean
}

function eventLevelUrl(event: DiscordActivityEvent, context: CommandContext) {
	return event.level
		? `${context.config.frontendUrl}/level/${event.level.xxHash}`
		: context.config.frontendUrl
}

function eventActions(event: DiscordActivityEvent, context: CommandContext) {
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(event.level ? 'Open level' : 'Open ZeepCentraal')
				.setStyle(ButtonStyle.Link)
				.setURL(eventLevelUrl(event, context)),
		),
	]
}

function eventFooter(event: DiscordActivityEvent) {
	return `ZeepCentraal • <t:${Math.floor(new Date(event.occurredAt).getTime() / 1000)}:R>`
}

function assertNever(value: never): never {
	throw new Error(`Unsupported Discord activity event kind: ${String(value)}`)
}

export async function rankEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return rankMessage(event, context)
}

export function workshopEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	const item = event.level?.levelItems.nodes[0]
	return messagePayload(
		displayContainer({
			actions: eventActions(event, context),
			accentColor: INFO_COLOR,
			description: `**${eventLevelName(event)}**\nBy ${playerLabel(item?.author)}`,
			footer: eventFooter(event),
			sections: [
				{
					content: `**Workshop ID**  ${String(item?.workshopId ?? event.payload?.workshopId ?? 'Unknown')}`,
					heading: 'Level details',
				},
			],
			thumbnail: item?.imageUrl
				? { description: `${eventLevelName(event)} thumbnail`, url: item.imageUrl }
				: undefined,
			title: 'New public workshop level',
		}),
	) satisfies MessageCreateOptions
}

export function personalBestEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return messagePayload(
		displayContainer({
			actions: eventActions(event, context),
			accentColor: SUCCESS_COLOR,
			description: eventLevelName(event),
			footer: eventFooter(event),
			sections: [
				{
					content: `**Player**  ${playerLabel(event.user)}\n**Time**  ${formatTime(event.record?.time)}`,
					heading: 'Personal best',
				},
			],
			title: 'New personal best',
		}),
	) satisfies MessageCreateOptions
}

export function voteEventMessage(event: DiscordActivityEvent, context: CommandContext) {
	return messagePayload(
		displayContainer({
			actions: eventActions(event, context),
			accentColor: INFO_COLOR,
			description: eventLevelName(event),
			footer: eventFooter(event),
			sections: [
				{
					content: `**Player**  ${playerLabel(event.user)}\n**Vote**  ${String(event.payload?.value ?? 'Unknown')}`,
					heading: 'Community vote',
				},
			],
			title: 'Level vote',
		}),
	) satisfies MessageCreateOptions
}

export async function worldRecordEventMessage(
	event: DiscordActivityEvent,
	context: CommandContext,
	options: EventMessageOptions = {},
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
	const discordId =
		event.previousRecord && !samePlayer ? event.previousUser?.discordId?.toString() : undefined
	const preference =
		options.includeLossPing !== false && discordId
			? await context.backend.user(discordId).catch(() => null)
			: null
	const shouldPing = Boolean(
		discordId &&
			discordId !== '-1' &&
			options.includeLossPing !== false &&
			preference?.preference?.pingOnWorldRecordLoss,
	)
	const notification = shouldPing ? `<@${discordId}> your world record was beaten.\n` : ''
	const points = Math.ceil(event.level?.levelPoints?.points ?? 0).toLocaleString('en')
	const personalBests = compactNumber(event.level?.personalBestGlobals.totalCount)

	return messagePayload(
		displayContainer({
			actions: eventActions(event, context),
			description: `${notification}**${eventLevelName(event)}**`,
			footer: eventFooter(event),
			sections: [
				{
					content: `**Record**  ${playerLabel(event.user)} • ${formatTime(event.record?.time)}\n${recordContext}\n**Level activity**  ${points} points • ${personalBests} personal bests`,
				},
			],
			thumbnail: levelItem?.imageUrl
				? { description: `${eventLevelName(event)} thumbnail`, url: levelItem.imageUrl }
				: undefined,
			title: 'New world record',
		}),
		{
			allowedMentions: shouldPing
				? { users: [discordId as string], parse: [] }
				: safeMentions,
		},
	) satisfies MessageCreateOptions
}

export async function eventMessage(
	event: DiscordActivityEvent,
	context: CommandContext,
	options: EventMessageOptions = {},
) {
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
			return worldRecordEventMessage(event, context, options)
		default:
			return assertNever(event.kind)
	}
}

import type { ChatInputCommandInteraction } from 'discord.js'
import { baseEmbed, compactNumber, formatTime, playerLabel, safeMentions } from '../../format'
import type { CommandContext } from '../context'
import { dateRange } from './date-range'
import { linkedUserOrThrow } from './linked-user'

function statisticAggregate(data: Record<string, unknown>) {
	return data.recordStatistics as {
		aggregates?: {
			average?: Record<string, number | null>
			max?: Record<string, number | null>
			sum?: Record<string, number | null>
		}
		totalCount: number
	}
}

export async function statisticsHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
	surface: boolean,
) {
	await interaction.deferReply()
	const linked = linkedUserOrThrow(await context.backend.user(interaction.user.id))
	const range = dateRange(
		interaction.options.getString('range', true),
		interaction.options.getString('from'),
		interaction.options.getString('to'),
		context.runtime.now(),
	)
	const data = await context.graphql.userStats(linked.id, range.from, range.to)
	const aggregates = statisticAggregate(data)
	const sums = aggregates.aggregates?.sum ?? {}
	const averages = aggregates.aggregates?.average ?? {}
	const maximums = aggregates.aggregates?.max ?? {}
	const fields = surface
		? [
				['Tarmac', sums.distanceOnTarmac],
				['Grass', sums.distanceOnGrass],
				['Sand', sums.distanceOnSand],
				['Soap', sums.distanceOnSoap],
				['Wood', sums.distanceOnWood],
				['Mud', sums.distanceOnMud],
				['Ice 5', sums.distanceOnIce1],
				['Ice 10', sums.distanceOnIce2],
				['Ice 15', sums.distanceOnIce3],
				['Airborne', sums.distanceInAir],
			].map(([name, value]) => ({
				name: String(name),
				value: `${compactNumber(value as number)} m`,
				inline: true,
			}))
		: [
				{
					name: 'Records',
					value: String((data.records as { totalCount: number }).totalCount),
					inline: true,
				},
				{
					name: 'PBs',
					value: String((data.personalBests as { totalCount: number }).totalCount),
					inline: true,
				},
				{
					name: 'WRs',
					value: String((data.worldRecords as { totalCount: number }).totalCount),
					inline: true,
				},
				{
					name: 'Levels / votes',
					value: `${(data.levels as { totalCount: number }).totalCount} / ${(data.votes as { totalCount: number }).totalCount}`,
					inline: true,
				},
				{
					name: 'Distance / time',
					value: `${compactNumber(sums.distance)} m / ${formatTime(sums.time)}`,
					inline: true,
				},
				{
					name: 'Average speed',
					value: `${Number(averages.averageSpeed ?? 0).toFixed(2)} km/h`,
					inline: true,
				},
				{
					name: 'Average G-force',
					value: Number(averages.averageGforce ?? 0).toFixed(2),
					inline: true,
				},
				{
					name: 'Maximum speed / G',
					value: `${Number(maximums.maxSpeed ?? 0).toFixed(2)} km/h / ${Number(maximums.maxGforce ?? 0).toFixed(2)} G`,
					inline: true,
				},
			]
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(
					`${surface ? 'Surface statistics' : 'Player statistics'} • ${range.label}`,
					playerLabel(linked),
				),
				fields,
			},
		],
		allowedMentions: safeMentions,
	})
}

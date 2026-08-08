import type { ChatInputCommandInteraction } from 'discord.js'
import { displayContainer, editPayload } from '../../display'
import { compactNumber, formatTime, playerLabel } from '../../format'
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
	const rows = surface
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
			].map(([name, value]) => `**${name}**  ${compactNumber(value as number)} m`)
		: [
				`**Records / PBs / WRs**  ${(data.records as { totalCount: number }).totalCount} / ${(data.personalBests as { totalCount: number }).totalCount} / ${(data.worldRecords as { totalCount: number }).totalCount}`,
				`**Levels / votes**  ${(data.levels as { totalCount: number }).totalCount} / ${(data.votes as { totalCount: number }).totalCount}`,
				`**Distance / time**  ${compactNumber(sums.distance)} m / ${formatTime(sums.time)}`,
				`**Average speed / G-force**  ${Number(averages.averageSpeed ?? 0).toFixed(2)} km/h / ${Number(averages.averageGforce ?? 0).toFixed(2)} G`,
				`**Maximum speed / G-force**  ${Number(maximums.maxSpeed ?? 0).toFixed(2)} km/h / ${Number(maximums.maxGforce ?? 0).toFixed(2)} G`,
			]
	await interaction.editReply(
		editPayload(
			displayContainer({
				description: `${playerLabel(linked)} • ${aggregates.totalCount} telemetry samples`,
				sections: [
					{
						content: rows.join('\n'),
						heading: surface ? 'Distance by surface' : 'Performance summary',
					},
				],
				title: `${surface ? 'Surface statistics' : 'Player statistics'} • ${range.label}`,
			}),
		),
	)
}

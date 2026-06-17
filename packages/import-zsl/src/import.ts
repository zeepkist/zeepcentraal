import { join } from 'node:path'
import { SUPER_LEAGUE_DATA } from './config'
import { importRound } from './importRound'
import { importSeason } from './importSeason'
import type { SuperLeagueMetadata } from './types'

const metadataPath = join(SUPER_LEAGUE_DATA, 'metadata.json')
const metadata = (await Bun.file(metadataPath).json()) as SuperLeagueMetadata

console.debug(`Loaded metadata for ${metadata.length} seasons from ${SUPER_LEAGUE_DATA}`)

for await (const [seasonName, seasonMetadata] of metadata) {
	console.debug(`Processing season: ${seasonName}`)
	const eventDates = Object.keys(seasonMetadata.events)
	const { season, userIdMap } = await importSeason(seasonName, seasonMetadata, eventDates)

	if (!season || !eventDates.length) {
		console.warn(`Skipping season ${seasonName} due to missing data or events`)
		continue
	}

	const events = Object.entries(seasonMetadata.events)

	for await (const [eventKey, eventMetadata] of events) {
		const index = eventDates.indexOf(eventKey)

		if (index === -1) {
			console.warn(`Event ${eventKey} not found in event dates for season ${seasonName}`)
			continue
		}

		await importRound({
			seasonName,
			idSeason: season.id,
			name: eventMetadata.name,
			round: index + 1,
			workshopId: eventMetadata.workshopId || '',
			eventDate: eventDates[index] || '',
			userIdMap,
		})
	}
}

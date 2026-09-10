import type { ValidationRow } from '@zeepkist/database/services/level-submissions'
import { sha256 } from '../validation/validate'

export function createSubmissionPlaylist(
	theme: string,
	rows: { validation: ValidationRow; workshopId: bigint }[],
) {
	const seen = new Set<string>()
	const members = rows.filter(({ validation, workshopId }) => {
		if (!validation.valid || !validation.payload || seen.has(String(workshopId))) return false
		seen.add(String(workshopId))
		return true
	})
	const content = {
		name: `${theme} - ${members.length}`,
		amountOfLevels: members.length,
		roundLength: 300,
		shufflePlaylist: false,
		UID: [],
		levels: members.map(({ validation, workshopId }) => ({
			UID: validation.payload!.uid,
			WorkshopID: workshopId.toString(),
			Name: validation.payload!.name,
			Author: validation.payload!.author,
		})),
	}
	if (members.length > 1001) throw new Error('Submission playlist exceeds protocol capacity')
	// Workshop IDs remain decimal JSON numbers without passing through JS Number.
	const json = JSON.stringify(content).replace(/"WorkshopID":"(\d+)"/g, '"WorkshopID":$1')
	const digest = sha256(
		JSON.stringify([content, members.map((m) => m.validation.payload!.sha256)]),
	)
	return { json, digest, members }
}

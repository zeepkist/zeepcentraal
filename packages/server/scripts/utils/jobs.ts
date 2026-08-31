import { type CompatibleTaskIdentifier, isValidTaskPayload } from '@zeepkist/jobs/task-definitions'
import {
	getValidationMessage,
	parseBoundedPositiveSafeInteger,
	parseNonnegativeSafeInteger,
	parsePositiveSafeInteger,
	parsePositiveSafeIntegerList,
	parseWorkshopId,
	parseWorkshopIdList,
} from './parsers'
import type { PromptAdapter, PromptOption } from './prompts'

export type JobCategory = 'Ghosts' | 'Workshop' | 'Tournament' | 'Scoring' | 'History'
export type JobOptions = Record<string, unknown>

export interface JobPromptDefinition {
	advanced?: boolean
	category: JobCategory
	collectOptions(prompt: PromptAdapter): Promise<JobOptions>
	description: string
	label: string
}

const integerValidator =
	(label: string, options: { maximum?: number; nonnegative?: boolean } = {}) =>
	(value: string | undefined): string | undefined =>
		getValidationMessage(value ?? '', (input) => {
			if (options.nonnegative) {
				return parseNonnegativeSafeInteger(input, label)
			}
			if (options.maximum !== undefined) {
				return parseBoundedPositiveSafeInteger(input, options.maximum, label)
			}
			return parsePositiveSafeInteger(input, label)
		})

const integerListValidator = (label: string, maximum?: number) => (value: string | undefined) =>
	getValidationMessage(value ?? '', (input) =>
		parsePositiveSafeIntegerList(input, { label, maximum }),
	)

const workshopListValidator = (maximum?: number) => (value: string | undefined) =>
	getValidationMessage(value ?? '', (input) =>
		parseWorkshopIdList(input, { label: 'Workshop IDs', maximum }),
	)

async function collectBackfillOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const mode = await prompt.select({
		message: 'Choose backfill mode',
		options: [
			{
				value: 'incomplete',
				label: 'Incomplete records',
				hint: 'Scan for records missing ghost statistics',
			},
			{
				value: 'v5',
				label: 'Reparse V5 statistics',
				hint: 'Repair V5 rows previously populated with V6-only telemetry',
			},
			{ value: 'ids', label: 'Record IDs', hint: 'Force-process selected records' },
		],
		initialValue: 'incomplete',
	})

	if (mode === 'ids') {
		const ids = await prompt.text({
			message: 'Record IDs (comma or whitespace separated)',
			validate: integerListValidator('Record IDs'),
		})
		return { ids: parsePositiveSafeIntegerList(ids, { label: 'Record IDs' }) }
	}

	const limit = await prompt.text({
		message: 'Records per batch',
		initialValue: '500',
		validate: integerValidator('Limit', { maximum: 500 }),
	})
	return {
		limit: parseBoundedPositiveSafeInteger(limit, 500, 'Limit'),
		...(mode === 'v5' ? { reparseGhostVersion: 5 } : {}),
	}
}

async function collectGhostBatchOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const ids = await prompt.text({
		message: 'Record IDs (maximum 500)',
		validate: integerListValidator('Record IDs', 500),
	})
	return {
		ids: parsePositiveSafeIntegerList(ids, { label: 'Record IDs', maximum: 500 }),
	}
}

async function collectWorkshopBatchOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const workshopIds = await prompt.text({
		message: 'Workshop IDs (maximum 10)',
		validate: workshopListValidator(10),
	})
	const fixHashes = await prompt.confirm({
		message: 'Repair ZeepSDK exponent hashes?',
		initialValue: false,
	})

	return {
		workshopIds: parseWorkshopIdList(workshopIds, {
			label: 'Workshop IDs',
			maximum: 10,
		}),
		...(fixHashes ? { fixZeepSDKExponentHashes: true } : {}),
	}
}

async function collectWorkshopItemOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const workshopId = await prompt.text({
		message: 'Workshop ID',
		validate: (value) => getValidationMessage(value ?? '', parseWorkshopId),
	})
	return { workshopId: parseWorkshopId(workshopId) }
}

async function collectTrackTournamentLobbyAssetOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const idTournament = await prompt.text({
		message: 'Tournament database ID',
		validate: integerValidator('Tournament ID'),
	})
	return { idTournament: parsePositiveSafeInteger(idTournament, 'Tournament ID') }
}

async function collectWorkshopCatalogOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const scope = await prompt.select({
		message: 'Choose Workshop catalog scan scope',
		options: [
			{ value: 'stale', label: 'Stale items', hint: 'Scan new, changed, or missing items' },
			{ value: 'all', label: 'Every item', hint: 'Force a full Workshop catalog rescan' },
			{
				value: 'repair-zsl',
				label: 'ZSL author repair',
				hint: 'Force packs uploaded by Akane and correct their level authors',
			},
		],
		initialValue: 'stale',
	})
	if (scope === 'stale') {
		return {}
	}
	if (scope === 'repair-zsl') {
		return { repairZslAuthors: true }
	}

	const fixHashes = await prompt.confirm({
		message: 'Repair ZeepSDK exponent hashes?',
		initialValue: false,
	})
	return {
		all: true,
		...(fixHashes ? { fixZeepSDKExponentHashes: true } : {}),
	}
}

async function collectLevelScoreOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const idLevel = await prompt.text({
		message: 'Level database ID',
		validate: integerValidator('Level ID'),
	})
	const updateUser = await prompt.confirm({
		message: 'Update one player score after level scoring?',
		initialValue: false,
	})
	const idUser = updateUser
		? await prompt.text({
				message: 'User database ID',
				validate: integerValidator('User ID'),
			})
		: undefined
	const reportOnly = await prompt.confirm({
		message: 'Run in report-only mode?',
		initialValue: false,
	})

	return {
		idLevel: parsePositiveSafeInteger(idLevel, 'Level ID'),
		...(idUser === undefined ? {} : { idUser: parsePositiveSafeInteger(idUser, 'User ID') }),
		...(reportOnly ? { reportOnly: true } : {}),
	}
}

async function collectLevelScoresOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const all = await prompt.confirm({
		message: 'Recalculate every eligible level?',
		initialValue: false,
	})
	const reportOnly = await prompt.confirm({
		message: 'Run in report-only mode?',
		initialValue: false,
	})
	return {
		...(all ? { all: true } : {}),
		...(reportOnly ? { reportOnly: true } : {}),
	}
}

async function collectPlayerScoreOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const idUser = await prompt.text({
		message: 'User database ID',
		validate: integerValidator('User ID'),
	})
	return { idUser: parsePositiveSafeInteger(idUser, 'User ID') }
}

async function collectHistoryBatchOptions(prompt: PromptAdapter): Promise<JobOptions> {
	const mode = await prompt.select({
		message: 'Choose batch mode',
		options: [
			{ value: 'ids', label: 'Database IDs' },
			{ value: 'range', label: 'Offset and limit' },
		],
		initialValue: 'range',
	})

	if (mode === 'ids') {
		const ids = await prompt.text({
			message: 'Database IDs (comma or whitespace separated)',
			validate: integerListValidator('Database IDs'),
		})
		return { ids: parsePositiveSafeIntegerList(ids, { label: 'Database IDs' }) }
	}

	const offset = await prompt.text({
		message: 'Offset',
		initialValue: '0',
		validate: integerValidator('Offset', { nonnegative: true }),
	})
	const limit = await prompt.text({
		message: 'Limit',
		initialValue: '200',
		validate: integerValidator('Limit'),
	})
	return {
		offset: parseNonnegativeSafeInteger(offset, 'Offset'),
		limit: parsePositiveSafeInteger(limit, 'Limit'),
	}
}

const emptyOptions = async (): Promise<JobOptions> => ({})

export const jobPromptDefinitions = {
	backfillRecordGhostStatistics: {
		category: 'Ghosts',
		label: 'Backfill record ghost statistics',
		description: 'Find incomplete records, repair V5 rows, or force selected record IDs',
		collectOptions: collectBackfillOptions,
	},
	backfillRecordGhostStatisticsBatch: {
		category: 'Ghosts',
		label: 'Backfill ghost statistics batch',
		description: 'Force-process up to 500 record IDs',
		advanced: true,
		collectOptions: collectGhostBatchOptions,
	},
	prepareTrackTournamentLobbyAsset: {
		category: 'Tournament',
		label: 'Prepare track tournament lobby asset',
		description: 'Backfill lobby level data for one weekly or monthly tournament',
		advanced: true,
		collectOptions: collectTrackTournamentLobbyAssetOptions,
	},
	scanWorkshopItem: {
		category: 'Workshop',
		label: 'Scan Workshop item',
		description: 'Scan one Steam Workshop item',
		collectOptions: collectWorkshopItemOptions,
	},
	scanWorkshopBatch: {
		category: 'Workshop',
		label: 'Scan Workshop batch',
		description: 'Scan up to 10 Steam Workshop items',
		advanced: true,
		collectOptions: collectWorkshopBatchOptions,
	},
	syncWorkshopCatalog: {
		category: 'Workshop',
		label: 'Synchronize Workshop catalog',
		description: 'Scan stale items or force every catalog item',
		collectOptions: collectWorkshopCatalogOptions,
	},
	syncPersonalBests: {
		category: 'Scoring',
		label: 'Synchronize personal bests',
		description: 'Run compatibility task (currently a no-op)',
		collectOptions: emptyOptions,
	},
	updateLevelScore: {
		category: 'Scoring',
		label: 'Update one level score',
		description: 'Calculate points for one level',
		collectOptions: collectLevelScoreOptions,
	},
	updateLevelScores: {
		category: 'Scoring',
		label: 'Update level scores',
		description: 'Calculate recent or all eligible level scores',
		collectOptions: collectLevelScoresOptions,
	},
	updatePlayerScore: {
		category: 'Scoring',
		label: 'Update one player score',
		description: 'Calculate points for one user',
		collectOptions: collectPlayerScoreOptions,
	},
	updatePlayerScores: {
		category: 'Scoring',
		label: 'Update player scores',
		description: 'Recalculate all player scores',
		collectOptions: emptyOptions,
	},
	prunePointsHistory: {
		category: 'History',
		label: 'Prune points history',
		description: 'Compact completed points-history weeks older than four weeks',
		advanced: true,
		collectOptions: emptyOptions,
	},
	updateLevelPointsHistory: {
		category: 'History',
		label: 'Update level-points history',
		description: 'Store current changed level-point snapshots',
		collectOptions: emptyOptions,
	},
	updateLevelPointsHistoryBatch: {
		category: 'History',
		label: 'Update level-points history batch',
		description: 'Store snapshots for selected IDs or a range',
		advanced: true,
		collectOptions: collectHistoryBatchOptions,
	},
	updateUserPointsHistory: {
		category: 'History',
		label: 'Update user-points history',
		description: 'Store current changed user-point snapshots',
		collectOptions: emptyOptions,
	},
	updateUserPointsHistoryBatch: {
		category: 'History',
		label: 'Update user-points history batch',
		description: 'Store snapshots for selected IDs or a range',
		advanced: true,
		collectOptions: collectHistoryBatchOptions,
	},
} satisfies Record<CompatibleTaskIdentifier, JobPromptDefinition>

export const jobChoices: readonly PromptOption<CompatibleTaskIdentifier>[] = Object.entries(
	jobPromptDefinitions,
).map(([value, definition]) => ({
	value: value as CompatibleTaskIdentifier,
	label: `${definition.category} · ${definition.label}`,
	hint: `${'advanced' in definition && definition.advanced ? 'Advanced · ' : ''}${definition.description}`,
}))

export async function collectJobOptions(
	prompt: PromptAdapter,
	task: CompatibleTaskIdentifier,
): Promise<JobOptions> {
	const options = await jobPromptDefinitions[task].collectOptions(prompt)
	if (!isValidTaskPayload(task, options)) {
		throw new Error(`Generated invalid payload for ${task}`)
	}
	return options
}

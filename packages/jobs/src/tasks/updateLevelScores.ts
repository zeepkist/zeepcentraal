import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
} from '@zeepkist/database'
import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from '../priorities'
import { createLevelScoreBatchJobs } from '../utils/createLevelScoreBatchJobs'
import { LEVEL_SCORE_MONITOR_QUEUE_NAME, levelScoreMonitorJobKey } from './monitorLevelScoreRun'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
	reportOnly?: boolean
}

export const RECENT_LEVEL_SCORE_LOOKBACK_MS = 60 * 60 * 1000

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	if (all) {
		helpers.logger.info('Rebuilding independent player-skill aggregates.')
		const rebuilt = await rebuildPlayerSkillAggregates()
		helpers.logger.info(`Rebuilt independent player skill for ${rebuilt} players.`)
	}
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(
				new Date(Date.now() - RECENT_LEVEL_SCORE_LOOKBACK_MS),
			)

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`)
	if (levelIds.length === 0) {
		return
	}

	const runId = crypto.randomUUID()
	const jobs = createLevelScoreBatchJobs(levelIds, {
		incremental: !all && !payload.reportOnly,
		reportOnly: payload.reportOnly,
		runId,
	})
	await helpers.addJobs(jobs)

	helpers.logger.info(`Queued ${jobs.length} updateLevelScoresBatch jobs for run ${runId}.`)
	if (payload.reportOnly) {
		return
	}

	await helpers.addJob(
		'monitorLevelScoreRun',
		{
			runId,
			check: 0,
			all,
			...(!all && { ids: levelIds }),
		},
		{
			jobKey: levelScoreMonitorJobKey(runId, 0),
			priority: all ? DEFAULT_JOB_PRIORITY : PRIORITY_JOB_PRIORITY,
			queueName: LEVEL_SCORE_MONITOR_QUEUE_NAME,
		},
	)
	helpers.logger.info(`Queued level score completion monitor for run ${runId}.`)
}

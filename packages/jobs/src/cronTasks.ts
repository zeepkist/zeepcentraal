import { WORKSHOP_JOB_PRIORITY } from './priorities'
import {
	PLAYER_SCORE_QUEUE_NAME,
	UPDATE_PLAYER_SCORES_JOB_KEY,
} from './utils/playerScoreJobOptions'

export const cronTasks = [
	{ task: 'recoverLevelRequests', cronTime: '0 * * * *' },
	{
		task: 'rotateTrackTournament',
		cronTime: '0 6 * * 1',
		payload: { type: 0 },
		timeZone: 'UTC',
		spec: { jobKey: 'cron:rotateTrackTournament:weekly' },
	},
	{
		task: 'rotateTrackTournament',
		cronTime: '0 6 1 * *',
		payload: { type: 1 },
		timeZone: 'UTC',
		spec: { jobKey: 'cron:rotateTrackTournament:monthly' },
	},
	// Workshop catalog sync
	{
		task: 'syncWorkshopCatalog',
		cronTime: '0 1 * * 0',
		spec: { priority: WORKSHOP_JOB_PRIORITY },
	}, // every Sunday at 01:00
	// Weekly full recalculation
	{
		task: 'updateLevelScores',
		cronTime: '0 1 * * 1',
		payload: { all: true },
		spec: {
			jobKey: 'update-level-scores:full',
			queueName: PLAYER_SCORE_QUEUE_NAME,
		},
	}, // every Monday at 01:00
	// Near-real-time leaderboard updates
	{
		task: 'updateLevelScores',
		cronTime: '*/30 * * * *',
		payload: { all: false },
		spec: {
			jobKey: 'update-level-scores:incremental',
			queueName: PLAYER_SCORE_QUEUE_NAME,
		},
	}, // every 30 minutes
	{
		task: 'updatePlayerScores',
		cronTime: '5-59/10 * * * *',
		spec: {
			jobKey: UPDATE_PLAYER_SCORES_JOB_KEY,
			queueName: PLAYER_SCORE_QUEUE_NAME,
		},
	}, // every 10 minutes, offset by 5 minutes
	// History snapshots
	{ task: 'updateLevelPointsHistory', cronTime: '0 * * * *' }, // every hour
	{ task: 'updateUserPointsHistory', cronTime: '0 0,12 * * *' }, // every 12 hours
] as const

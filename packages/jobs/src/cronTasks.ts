import { WORKSHOP_JOB_PRIORITY } from './priorities'

export const cronTasks = [
	// Workshop catalog sync
	{
		task: 'syncWorkshopCatalog',
		cronTime: '0 1 * * 0',
		spec: { priority: WORKSHOP_JOB_PRIORITY },
	}, // every Sunday at 01:00
	// Weekly full recalculation
	{ task: 'updateLevelScores', cronTime: '0 1 * * 1', payload: { all: true } }, // every Monday at 01:00
	// Near-real-time leaderboard updates
	{ task: 'updateLevelScores', cronTime: '*/10 * * * *', payload: { all: false } }, // every 10 minutes
	{ task: 'updatePlayerScores', cronTime: '5-59/20 * * * *' }, // every 20 minutes, offset by 5 minutes
	// History snapshots
	{ task: 'updateLevelPointsHistory', cronTime: '0 * * * *' }, // every hour
	{ task: 'updateUserPointsHistory', cronTime: '0 0,12 * * *' }, // every 12 hours
] as const

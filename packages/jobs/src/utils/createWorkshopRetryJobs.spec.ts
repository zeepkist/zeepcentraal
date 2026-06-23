import { expect, test } from 'bun:test'
import { createWorkshopRetryJobs, formatWorkshopFailure } from './createWorkshopRetryJobs'

test('creates isolated workshop retries with stable keys', () => {
	expect(createWorkshopRetryJobs([3650825316n])).toEqual([
		{
			identifier: 'scanWorkshopItem',
			payload: { workshopId: '3650825316' },
			jobKey: 'scan-workshop-item:3650825316',
			maxAttempts: 5,
			priority: 5,
		},
	])
})

test('formats underlying workshop failure', () => {
	expect(formatWorkshopFailure(new Error('SteamCMD failed (5): timeout'))).toBe(
		'SteamCMD failed (5): timeout',
	)
})

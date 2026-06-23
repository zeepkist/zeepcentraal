import { expect, test } from 'bun:test'
import { WORKSHOP_JOB_PRIORITY } from '../priorities'
import { createWorkshopRetryJobs, formatWorkshopFailure } from './createWorkshopRetryJobs'

test('creates isolated workshop retries with stable keys', () => {
	expect(createWorkshopRetryJobs([3650825316n])).toEqual([
		{
			identifier: 'scanWorkshopItem',
			payload: { workshopId: '3650825316' },
			jobKey: 'scan-workshop-item:3650825316',
			maxAttempts: 5,
			priority: WORKSHOP_JOB_PRIORITY,
		},
	])
})

test('formats underlying workshop failure', () => {
	expect(formatWorkshopFailure(new Error('SteamCMD failed (5): timeout'))).toBe(
		'SteamCMD failed (5): timeout',
	)
})

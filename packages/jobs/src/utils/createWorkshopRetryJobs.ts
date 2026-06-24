import { WORKSHOP_JOB_PRIORITY } from '../priorities'

export function createWorkshopRetryJobs(workshopIds: bigint[]) {
	return workshopIds.map((workshopId) => ({
		identifier: 'scanWorkshopItem' as const,
		payload: { workshopId: workshopId.toString() },
		jobKey: `scan-workshop-item:${workshopId}`,
		maxAttempts: 2,
		priority: WORKSHOP_JOB_PRIORITY,
	}))
}

export function formatWorkshopFailure(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

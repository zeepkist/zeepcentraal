export function createWorkshopRetryJobs(workshopIds: bigint[]) {
	return workshopIds.map((workshopId) => ({
		identifier: 'scanWorkshopItem' as const,
		payload: { workshopId: workshopId.toString() },
		jobKey: `scan-workshop-item:${workshopId}`,
		maxAttempts: 5,
		priority: 5,
	}))
}

export function formatWorkshopFailure(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

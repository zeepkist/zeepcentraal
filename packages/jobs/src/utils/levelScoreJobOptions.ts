export function levelScoreJobOptions(
	task: string,
	payload: Record<string, unknown>,
): { jobKey?: string } {
	if (task !== 'updateLevelScore' || typeof payload.idLevel !== 'number') {
		return {}
	}

	return {
		jobKey: `update-level-score${payload.reportOnly === true ? '-report' : ''}:${payload.idLevel}`,
	}
}

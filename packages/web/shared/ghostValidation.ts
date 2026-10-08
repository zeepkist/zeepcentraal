export type ValidationReport = {
	status: string
	comparison?: boolean
	reasons: string[]
	matchedGroups: string[][]
	missingGroups: string[][]
	validatorVersion: string
}
export type ValidationAttempt = {
	id: string
	id_record: number
	id_level: string
	status: string
	ghost_digest: string | null
	level_xx_hash: string | null
	created_at: string
	updated_at: string
	validator_version: string
	report: ValidationReport
}
export type ValidationReview = {
	attempts?: ValidationAttempt[]
	record: { id: number; levelId: number; time: number; steamId: string; hash: string }
	snapshots: Array<{
		snapshot: {
			id: string | number
			canonicalHash: string
			blocks: unknown
			environment?: unknown
			typeSkybox?: number
		}
		overlays: Array<{ uid: string; shape: string; finish: boolean; vertices: number[][] }>
	}>
}

export function validationCsv(attempts: ValidationAttempt[]): string {
	const cell = (value: unknown) => {
		let text = String(value ?? '')
		if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
		return `"${text.replaceAll('"', '""')}"`
	}
	return [
		[
			'id',
			'record',
			'level',
			'status',
			'reasons',
			'missingGroups',
			'ghostDigest',
			'levelXxHash',
			'validator',
			'observedAt',
		],
		...attempts.map((a) => [
			a.id,
			a.id_record,
			a.id_level,
			a.status,
			a.report.reasons.join(';'),
			JSON.stringify(a.report.missingGroups),
			a.ghost_digest,
			a.level_xx_hash,
			a.validator_version,
			a.updated_at,
		]),
	]
		.map((row) => row.map(cell).join(','))
		.join('\r\n')
}

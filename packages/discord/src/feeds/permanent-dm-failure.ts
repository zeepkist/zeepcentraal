export function permanentDmFailure(error: unknown) {
	const code = (error as { code?: unknown } | null)?.code
	return code === 50007 || code === 50013 || code === 10013
}

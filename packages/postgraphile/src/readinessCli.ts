type ReadyCheckOptions = {
	fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
	port: number
	timeoutMs: number
}

export async function runPostGraphileReadyCheck({
	fetchImpl = fetch,
	port,
	timeoutMs,
}: ReadyCheckOptions): Promise<number> {
	try {
		const response = await fetchImpl(`http://127.0.0.1:${port}/readyz`, {
			headers: { accept: 'text/plain' },
			signal: AbortSignal.timeout(timeoutMs),
		})
		return response.ok ? 0 : 1
	} catch {
		return 1
	}
}

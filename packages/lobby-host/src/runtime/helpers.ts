export function delay(ms: number, signal?: AbortSignal) {
	if (signal?.aborted) return Promise.resolve()
	return new Promise<void>((resolve) => {
		const timer = setTimeout(complete, ms)
		function complete() {
			clearTimeout(timer)
			signal?.removeEventListener('abort', complete)
			resolve()
		}
		signal?.addEventListener('abort', complete, { once: true })
	})
}
export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(message)), ms)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}
export function safeError(error: unknown) {
	return (error instanceof Error ? error.message : 'Unknown error')
		.replace(/[\r\n\t]/g, ' ')
		.slice(0, 200)
}
export function withJitter(ms: number) {
	return Math.round(ms * (0.8 + Math.random() * 0.4))
}

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
	if (!(error instanceof Error)) return 'Unknown error'
	const message = sanitizeErrorMessage(error.message)
	const metadata = findErrorMetadata(error)
	return `${message}${metadata}`.slice(0, 200)
}
export function withJitter(ms: number) {
	return Math.round(ms * (0.8 + Math.random() * 0.4))
}

function sanitizeErrorMessage(message: string) {
	if (/^Failed query:/i.test(message)) return 'Database query failed'
	return message
		.replace(/[\r\n\t]/g, ' ')
		.replace(/\b(Bearer)\s+\S+/gi, '$1 [redacted]')
		.replace(/\b(token|password|secret)=([^\s,;]+)/gi, '$1=[redacted]')
		.replace(/\b(postgres(?:ql)?):\/\/[^@\s]+@/gi, '$1://[redacted]@')
}

function findErrorMetadata(error: Error) {
	let current: unknown = error
	for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
		const value = current as Error & { code?: unknown; syscall?: unknown }
		const code = safeErrorField(value.code)
		const syscall = safeErrorField(value.syscall)
		if (code || syscall) {
			const fields = [code && `code=${code}`, syscall && `syscall=${syscall}`].filter(Boolean)
			return ` (${fields.join(', ')})`
		}
		current = current.cause
	}
	return ''
}

function safeErrorField(value: unknown) {
	return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined
}

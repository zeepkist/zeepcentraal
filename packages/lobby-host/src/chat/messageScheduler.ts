/** Connection-local coalescing and periodic delivery; policy supplies content and intervals. */
export class MessageScheduler {
	private timer?: ReturnType<typeof setTimeout>
	private debounce?: ReturnType<typeof setTimeout>
	private queue = Promise.resolve()
	private closed = false
	constructor(
		private readonly send: () => Promise<void>,
		private readonly onError: (error: unknown) => void,
	) {}
	request(ms: number) {
		if (this.closed || this.debounce) return
		this.debounce = setTimeout(() => {
			this.debounce = undefined
			this.queue = this.queue
				.then(async () => {
					if (!this.closed) await this.send()
				})
				.catch((error) => {
					if (!this.closed) this.onError(error)
				})
		}, ms)
	}
	refresh(ms: number) {
		if (this.closed) return
		if (this.timer) clearTimeout(this.timer)
		this.timer = setTimeout(() => {
			this.timer = undefined
			this.request(0)
		}, ms)
	}
	close() {
		this.closed = true
		if (this.timer) clearTimeout(this.timer)
		if (this.debounce) clearTimeout(this.debounce)
	}
}

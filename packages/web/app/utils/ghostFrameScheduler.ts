type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void

export class GhostFrameScheduler {
	private pendingHandle: number | null = null

	constructor(
		private readonly requestFrame: RequestFrame,
		private readonly cancelFrame: CancelFrame,
		private readonly callback: FrameRequestCallback,
	) {}

	get pending() {
		return this.pendingHandle !== null
	}

	request() {
		if (this.pendingHandle !== null) return
		this.pendingHandle = this.requestFrame(this.run)
	}

	cancel() {
		if (this.pendingHandle === null) return
		this.cancelFrame(this.pendingHandle)
		this.pendingHandle = null
	}

	private readonly run: FrameRequestCallback = (timestamp) => {
		this.pendingHandle = null
		this.callback(timestamp)
	}
}

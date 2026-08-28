const MAX_PENDING_PARSERS = 4
const MAX_ACTIVE_UPLOADS = 2
const MAX_UPLOAD_RESERVATIONS = MAX_ACTIVE_UPLOADS + 4
const MAX_RETAINED_UPLOAD_BYTES = 64 * 1024 * 1024

type UploadTask = { byteLength: number; run: () => Promise<void> }

export class RecordWorkCapacityError extends Error {
	public constructor(message: string) {
		super(message)
		this.name = 'RecordWorkCapacityError'
	}
}

export class UploadReservation implements Disposable {
	private scheduled = false
	private released = false

	public constructor(
		private readonly owner: RecordWorkManager,
		public readonly byteLength: number,
	) {}

	public schedule(run: () => Promise<void>): void {
		if (this.scheduled || this.released) throw new Error('Upload reservation is unavailable')
		this.scheduled = true
		this.owner.scheduleUpload({ byteLength: this.byteLength, run })
	}

	public [Symbol.dispose](): void {
		if (this.scheduled || this.released) return
		this.released = true
		this.owner.releaseUpload(this.byteLength)
	}
}

export class RecordWorkManager {
	private activeParser = false
	private readonly parserWaiters: Array<() => void> = []
	private activeUploads = 0
	private uploadReservations = 0
	private retainedUploadBytes = 0
	private readonly uploadQueue: UploadTask[] = []
	private readonly idleWaiters = new Set<() => void>()

	public async runParser<T>(task: () => Promise<T>): Promise<T> {
		if (this.activeParser) {
			if (this.parserWaiters.length >= MAX_PENDING_PARSERS) {
				throw new RecordWorkCapacityError('Ghost parser queue is full')
			}
			await new Promise<void>((resolve) => this.parserWaiters.push(resolve))
		} else {
			this.activeParser = true
		}
		try {
			return await task()
		} finally {
			const next = this.parserWaiters.shift()
			if (next) next()
			else this.activeParser = false
			this.notifyIdle()
		}
	}

	public reserveUpload(byteLength: number): UploadReservation {
		if (
			this.uploadReservations >= MAX_UPLOAD_RESERVATIONS ||
			this.retainedUploadBytes + byteLength > MAX_RETAINED_UPLOAD_BYTES
		) {
			throw new RecordWorkCapacityError('Ghost upload queue is full')
		}
		this.uploadReservations++
		this.retainedUploadBytes += byteLength
		return new UploadReservation(this, byteLength)
	}

	public scheduleUpload(task: UploadTask): void {
		this.uploadQueue.push(task)
		this.pumpUploads()
	}

	public releaseUpload(byteLength: number): void {
		this.uploadReservations--
		this.retainedUploadBytes -= byteLength
		this.notifyIdle()
	}

	public async drain(timeoutMs = 8_000): Promise<boolean> {
		if (this.isIdle()) return true
		let timeout: ReturnType<typeof setTimeout> | undefined
		let idleResolver: (() => void) | undefined
		const idle = new Promise<void>((resolve) => {
			idleResolver = resolve
			this.idleWaiters.add(resolve)
		})
		const timedOut = new Promise<boolean>((resolve) => {
			timeout = setTimeout(() => resolve(false), timeoutMs)
		})
		const drained = await Promise.race([idle.then(() => true), timedOut])
		if (timeout) clearTimeout(timeout)
		if (idleResolver) this.idleWaiters.delete(idleResolver)
		if (!drained) {
			for (const queued of this.uploadQueue.splice(0)) this.releaseUpload(queued.byteLength)
		}
		return drained
	}

	private pumpUploads(): void {
		while (this.activeUploads < MAX_ACTIVE_UPLOADS) {
			const task = this.uploadQueue.shift()
			if (!task) break
			this.activeUploads++
			void task
				.run()
				.catch((error) => console.error('[ghost] Queued media upload failed:', error))
				.finally(() => {
					this.activeUploads--
					this.releaseUpload(task.byteLength)
					this.pumpUploads()
				})
		}
	}

	private isIdle(): boolean {
		return (
			!this.activeParser &&
			this.parserWaiters.length === 0 &&
			this.activeUploads === 0 &&
			this.uploadReservations === 0
		)
	}

	private notifyIdle(): void {
		if (!this.isIdle()) return
		for (const resolve of this.idleWaiters) resolve()
		this.idleWaiters.clear()
	}
}

export const recordWork = new RecordWorkManager()

export function drainRecordWork(timeoutMs = 8_000): Promise<boolean> {
	return recordWork.drain(timeoutMs)
}

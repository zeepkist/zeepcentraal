import { delay, safeError } from './helpers'

export interface SupervisedRoom {
	host: { run(): Promise<void>; stop(): Promise<void> }
	key: string
}

export class LobbyHostSupervisor {
	private stopped = false
	private runPromise?: Promise<void>
	private stopPromise?: Promise<void>
	private readonly controller = new AbortController()
	constructor(
		private readonly hosts: readonly SupervisedRoom[],
		private readonly closeShared: () => Promise<void>,
		private readonly restartDelayMs = 1_000,
	) {}
	async run() {
		this.runPromise ??= Promise.all(
			this.hosts.map(({ host, key }) => this.supervise(host, key)),
		).then(() => undefined)
		await this.runPromise
	}
	stop() {
		this.stopPromise ??= this.stopOnce()
		return this.stopPromise
	}
	private async stopOnce() {
		this.stopped = true
		this.controller.abort()
		const results = await Promise.allSettled(this.hosts.map(({ host }) => host.stop()))
		await this.closeShared()
		const failure = results.find(
			(result): result is PromiseRejectedResult => result.status === 'rejected',
		)
		if (failure) throw failure.reason
	}
	private async supervise(host: SupervisedRoom['host'], key: string) {
		while (!this.stopped) {
			try {
				await host.run()
				if (!this.stopped)
					console.warn(`[${key}] Managed room stopped unexpectedly; restarting.`)
			} catch (error) {
				if (!this.stopped)
					console.warn(`[${key}] Managed room failed; restarting: ${safeError(error)}`)
			}
			if (!this.stopped) await delay(this.restartDelayMs, this.controller.signal)
		}
	}
}

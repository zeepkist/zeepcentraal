export interface LevelPayloadLease {
	data: Uint8Array
	release(): void
}

interface CacheEntry {
	data?: Uint8Array
	promise: Promise<Uint8Array>
	references: number
}

export class LevelPayloadCache {
	private readonly entries = new Map<string, CacheEntry>()

	async acquire(hash: string, load: () => Promise<Uint8Array>): Promise<LevelPayloadLease> {
		let entry = this.entries.get(hash)
		if (!entry) {
			const created: CacheEntry = { promise: Promise.resolve().then(load), references: 0 }
			entry = created
			this.entries.set(hash, created)
			void created.promise.then(
				(data) => {
					created.data = data
				},
				() => {
					if (this.entries.get(hash) === created) this.entries.delete(hash)
				},
			)
		}
		const current = entry
		current.references++
		try {
			const data = current.data ?? (await current.promise)
			let released = false
			return {
				data,
				release: () => {
					if (released) return
					released = true
					current.references--
					if (current.references === 0 && this.entries.get(hash) === current)
						this.entries.delete(hash)
				},
			}
		} catch (error) {
			current.references--
			throw error
		}
	}

	get size() {
		return this.entries.size
	}
}

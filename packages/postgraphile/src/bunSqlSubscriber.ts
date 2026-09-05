import type { SQL } from 'bun'

/** Bun multiplexes topics on one dedicated connection and resubscribes after reconnect. */
export class BunSqlSubscriber {
	private readonly iterators = new Set<AsyncIterableIterator<string>>()
	private released = false

	constructor(private readonly client: SQL) {}

	subscribe(topic: string): AsyncIterableIterator<string> {
		if (this.released) throw new Error('This BunSqlSubscriber has been released.')
		const values: string[] = []
		const waiting: Array<ReturnType<typeof Promise.withResolvers<IteratorResult<string>>>> = []
		let finished = false
		let failure: unknown
		let failed = false
		const subscription = this.client.listen(topic, (value) => {
			if (finished) return
			const next = waiting.shift()
			if (next) next.resolve({ done: false, value })
			else values.push(value)
		})
		const finish = async (error?: unknown) => {
			if (!finished) {
				finished = true
				failed = error !== undefined
				failure = error
				values.length = 0
				for (const next of waiting.splice(0)) {
					if (failed) next.reject(error)
					else next.resolve({ done: true, value: undefined })
				}
				this.iterators.delete(iterator)
				await subscription.then(
					(handle) => handle.unlisten(),
					() => {},
				)
			}
			return { done: true as const, value: undefined }
		}
		const iterator: AsyncIterableIterator<string> = {
			[Symbol.asyncIterator]() {
				return this
			},
			async next() {
				if (failed) throw failure
				if (finished) return { done: true, value: undefined }
				const value = values.shift()
				if (value !== undefined) return { done: false, value }
				const next = Promise.withResolvers<IteratorResult<string>>()
				waiting.push(next)
				return next.promise
			},
			return: () => finish(),
			throw: async (error) => {
				await finish(error)
				throw error
			},
		}
		this.iterators.add(iterator)
		void subscription.catch((error: unknown) => finish(error))
		return iterator
	}

	async release() {
		this.released = true
		await Promise.all([...this.iterators].map((iterator) => iterator.return?.()))
	}
}

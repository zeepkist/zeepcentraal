export async function runWithConcurrency<T>(
	items: readonly T[],
	concurrency: number,
	operation: (item: T, index: number) => Promise<void>,
): Promise<void> {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new RangeError('Concurrency must be a positive integer.')
	}

	function* workItems() {
		for (const [index, item] of items.entries()) yield { index, item }
	}

	const pending = workItems()
	let failed = false
	let failure: unknown

	async function worker() {
		while (!failed) {
			const next = pending.next()
			if (next.done) return

			try {
				await operation(next.value.item, next.value.index)
			} catch (error) {
				if (!failed) {
					failed = true
					failure = error
				}
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
	if (failed) throw failure
}

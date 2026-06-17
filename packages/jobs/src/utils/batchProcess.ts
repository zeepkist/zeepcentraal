export function* batchProcess<T>(items: T[], batchSize = 20): Generator<T[]> {
	for (let index = 0; index < items.length; index += batchSize) {
		yield items.slice(index, index + batchSize);
	}
}

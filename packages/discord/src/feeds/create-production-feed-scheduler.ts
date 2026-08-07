import type { FeedScheduler } from './feed-scheduler'

export function createProductionFeedScheduler(): FeedScheduler {
	return { clearInterval, setInterval }
}

import { useClientHandle } from '@urql/vue'
import { Zc_SupporterBadgesDocument, Zc_SupporterUsersDocument } from '@zeepkist/graphql/generated'
import type { SupporterMap, SupporterStatus } from '~/utils/supporters'

const BATCH_SIZE = 1000

function nextCursor(
	pageInfo: { hasNextPage: boolean; endCursor?: unknown },
	previous: string | undefined,
): string | undefined {
	if (!pageInfo.hasNextPage) return undefined
	if (
		typeof pageInfo.endCursor !== 'string' ||
		!pageInfo.endCursor ||
		pageInfo.endCursor === previous
	) {
		throw new Error('Invalid supporter pagination cursor')
	}
	return pageInfo.endCursor
}

/** One public snapshot per page load, reused across navigation, pagination, and lazy tables. */
export function useSupporterBadges() {
	const { client } = useClientHandle()
	const { data: supporters } = useAsyncData<SupporterMap>(
		'supporter-badges',
		async () => {
			try {
				const donations = new Map<string, SupporterStatus>()
				let after: string | undefined
				do {
					const result = await client
						.query(Zc_SupporterBadgesDocument, { after })
						.toPromise()
					const page = result.data?.donations
					if (result.error || !page) return {}
					for (const donation of page.nodes) {
						donations.set(String(donation.discordUserid), {
							isSubscriptionPayment: donation.isSubscriptionPayment === true,
							tierName: donation.tierName ?? null,
						})
					}
					after = nextCursor(page.pageInfo, after)
				} while (after)

				const snapshot: Record<number, SupporterStatus> = {}
				const discordIds = [...donations.keys()]
				for (let offset = 0; offset < discordIds.length; offset += BATCH_SIZE) {
					const batch = discordIds.slice(offset, offset + BATCH_SIZE)
					after = undefined
					do {
						const result = await client
							.query(Zc_SupporterUsersDocument, { discordIds: batch, after })
							.toPromise()
						const page = result.data?.users
						if (result.error || !page) return {}
						for (const user of page.nodes) {
							const donation = donations.get(String(user.discordId))
							if (donation) snapshot[user.id] = donation
						}
						after = nextCursor(page.pageInfo, after)
					} while (after)
				}
				return snapshot
			} catch {
				// Badge failures must never break the main page.
				return {}
			}
		},
		{
			default: (): SupporterMap => ({}),
			deep: false,
			dedupe: 'defer',
			getCachedData: (key, app) => app.payload.data[key] ?? app.static.data[key],
		},
	)
	return { supporters }
}

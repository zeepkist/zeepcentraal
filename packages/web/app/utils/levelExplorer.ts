import type { LevelFilter } from '~/graphql/generated/graphql'

export type LevelTypeFilter = 'all' | 'yes' | 'no'

const accessibleCommunityFilter: LevelFilter = {
	adventure: { equalTo: false },
	levelItems: { some: { deleted: { equalTo: false } } },
}

export function buildLevelAvailabilityFilter(type: string): LevelFilter {
	if (type === 'yes') return { adventure: { equalTo: true } }
	if (type === 'no') return accessibleCommunityFilter
	return {
		or: [{ adventure: { equalTo: true } }, accessibleCommunityFilter],
	}
}

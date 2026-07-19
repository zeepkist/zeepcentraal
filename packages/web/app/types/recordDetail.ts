import type {
	Zc_GhostComparisonRecordFragment,
	Zc_RecordDetailQuery,
	Zc_RecordStatisticFragment,
} from '~/graphql/generated/graphql'
import type { GhostRecordSource } from '~/types/ghost'

export type RecordDetailRecord = NonNullable<Zc_RecordDetailQuery['record']>
export type RecordDetailStatistic = Zc_RecordStatisticFragment
export type RecordComparisonRecord = Zc_GhostComparisonRecordFragment

export type RecordComparisonCatalog = {
	topPersonalBests: GhostRecordSource[]
	ownerRuns: GhostRecordSource[]
	viewerPersonalBest: GhostRecordSource | null
}

export type RecordComparisonUser = {
	id: number
	steamId: string | null
	name: string
	personalBest: GhostRecordSource | null
}

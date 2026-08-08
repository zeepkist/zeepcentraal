import type {
	Zc_GhostComparisonRecordFragment,
	Zc_RecordDetailQuery,
	Zc_RecordStatisticFragment,
} from '@zeepkist/graphql/generated'
import type { GhostRecordSource } from '~/types/ghost'

export type RecordDetailRecord = NonNullable<Zc_RecordDetailQuery['record']>
export type RecordDetailStatistic = Zc_RecordStatisticFragment
export type RecordComparisonRecord = Zc_GhostComparisonRecordFragment

export type RecordHeroSource = {
	recordId: number
	userSteamId: string | null
	userName: string | null
	time: number
	dateCreated: string
	isWorldRecord: boolean
	isPersonalBest: boolean
}

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

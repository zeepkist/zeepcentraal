import { useQuery } from '@urql/vue'
import { Zc_RecordDetailSummaryDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { RecordHeroSource } from '~/types/recordDetail'

export function useRecordDetailSummary(recordId: Ref<number>) {
	const detail = useQuery({
		query: Zc_RecordDetailSummaryDocument,
		variables: computed(() => ({ recordId: recordId.value })),
	})
	const record = computed(() => detail.data.value?.record ?? null)
	const hero = computed<RecordHeroSource | null>(() => {
		const value = record.value
		if (!value) return null

		return {
			recordId: value.id,
			userSteamId: value.user?.steamId == null ? null : String(value.user.steamId),
			userName: value.user?.steamName ?? null,
			time: value.time,
			dateCreated: String(value.dateCreated),
			isWorldRecord: value.worldRecordGlobals.totalCount > 0,
			isPersonalBest: value.personalBestGlobals.totalCount > 0,
		}
	})
	const levelItem = computed(() => record.value?.level?.levelItems.nodes[0] ?? null)
	useDiscordComponentEmbed(() => {
		const value = record.value
		if (!value) return
		const item = value.level?.publiclyVisible ? levelItem.value : null
		return {
			title: `${formatOgTime(value.time)} | ${item?.name ?? value.level?.xxHash ?? 'Record'}`,
			description: `${value.user?.steamName ?? value.user?.steamId ?? 'Unknown player'} | ${String(value.dateCreated)}`,
			image: item?.imageUrl,
			rows: [
				{
					...discordStandingRow(value),
					rank: value.userPointContributions.nodes[0]?.levelPosition,
				},
			],
			links: value.level
				? [{ label: 'Level standings', url: `/level/${value.level.xxHash}` }]
				: [],
		}
	})

	async function prefetchCritical() {
		if (import.meta.server) await detail
	}

	return {
		detail,
		hero,
		levelItem,
		record,
		prefetchCritical,
	}
}

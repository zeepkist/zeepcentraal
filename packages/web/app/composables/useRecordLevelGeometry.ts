import { useQuery } from '@urql/vue'
import type { Ref } from 'vue'
import { Zc_RecordLevelGeometryDocument } from '~/graphql/generated/graphql'
import type { GhostLevelBlock } from '~/types/ghost'
import { parseLevelGeometryBlocks } from '~/utils/ghostLevelGeometry'

export function useRecordLevelGeometry(levelId: Ref<number | undefined>) {
	const hydrated = ref(false)
	onMounted(() => {
		hydrated.value = true
	})
	const query = useQuery({
		query: Zc_RecordLevelGeometryDocument,
		variables: computed(() => ({ levelId: levelId.value ?? 0 })),
		pause: computed(() => import.meta.server || !hydrated.value || levelId.value === undefined),
	})
	const metadata = computed(() => query.data.value?.level?.levelMetadata.nodes[0] ?? null)
	const blocks = computed<GhostLevelBlock[]>(() =>
		parseLevelGeometryBlocks(metadata.value?.blocks),
	)
	return { blocks, hydrated, metadata, query }
}

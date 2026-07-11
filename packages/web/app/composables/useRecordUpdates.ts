import { useSubscription } from '@urql/vue'
import ZcRecordUpdatesSubscription from '~/graphql/subscriptions/recordUpdates.graphql'

export function useRecordUpdates() {
	const isMounted = ref(false)

	onMounted(() => {
		isMounted.value = true
	})

	return useSubscription({
		query: ZcRecordUpdatesSubscription,
		pause: computed(() => !isMounted.value),
	})
}

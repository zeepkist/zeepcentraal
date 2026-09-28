<script setup vapor lang="ts">
import type { SupporterStatus } from '~/utils/supporters'

const props = defineProps<{ supporter?: SupporterStatus }>()
const { t } = useI18n()
const label = computed(() => {
	const supporter = t(props.supporter?.isSubscriptionPayment ? 'support.badge.monthly' : 'support.badge.supporter')
	return props.supporter?.tierName ? t('support.badge.tier', { supporter, tier: props.supporter.tierName }) : supporter
})
</script>

<template>
	<span v-if="supporter" :aria-label="label" :title="label" role="img" class="ml-1.5 inline-flex shrink-0 align-middle" :class="supporter.isSubscriptionPayment ? 'text-pink-500 dark:text-pink-400' : undefined">
		<TablerIcon name="heart-handshake" class="size-[1em]" />
	</span>
</template>

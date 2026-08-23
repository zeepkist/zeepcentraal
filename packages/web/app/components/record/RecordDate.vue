<script setup vapor lang="ts">
import { useRecordDateNow } from '~/composables/useRecordDateNow'
import { getRecordDatePrimaryPercentage } from '~/utils/recordDate'

const props = withDefaults(
	defineProps<{
		datetime: string | number | Date
		showFullDate?: boolean
	}>(),
	{
		showFullDate: false,
	},
)

const now = useRecordDateNow()
const dateStyle = computed(() => {
	const primaryPercentage = getRecordDatePrimaryPercentage(
		props.datetime,
		now.value.getTime(),
	)
	return {
		color: `color-mix(in oklab, var(--primary) ${primaryPercentage}%, var(--foreground))`,
	}
})
</script>

<template>
	<NuxtTime
		v-if="showFullDate"
		:datetime="datetime"
		:style="dateStyle"
		date-style="medium"
		time-style="short"
	/>
	<NuxtTime
		v-else
		:datetime="datetime"
		:style="dateStyle"
		relative
		numeric="auto"
		relative-style="short"
	/>
</template>

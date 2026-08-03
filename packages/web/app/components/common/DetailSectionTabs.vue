<template>
	<section :aria-label="label">
		<UTabs
			v-model="activeTab"
			:items="tabItems"
			:aria-label="label"
			:unmount-on-hide="false"
			color="primary"
			variant="pill"
			class="w-full"
			:ui="{
				list: 'w-full flex-wrap justify-start rounded-xl border border-border bg-card/60 p-1.5',
				content: 'pt-6 outline-none',
			}"
		>
			<template v-for="item in items" :key="item.value" #[item.value]>
				<div v-if="visitedTabs.has(item.value)" class="space-y-8 lg:space-y-10">
					<slot :name="item.value" />
				</div>
			</template>
		</UTabs>
	</section>
</template>

<script setup vapor lang="ts" generic="T extends string">
import type { DetailSectionTabItem } from '~/types/detailTabs'

const props = defineProps<{
	modelValue: T
	items: Array<DetailSectionTabItem<T>>
	label: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const visitedTabs = shallowReactive(new Set<T>([props.modelValue]))

const activeTab = computed<T>({
	get: () => props.modelValue,
	set: (value) => {
		visitedTabs.add(value)
		emit('update:modelValue', value)
	},
})

watch(
	() => props.modelValue,
	(value) => visitedTabs.add(value),
)

const tabItems = computed(() =>
	props.items.map((item) => ({
		label: item.label,
		slot: item.value,
		value: item.value,
	})),
)
</script>

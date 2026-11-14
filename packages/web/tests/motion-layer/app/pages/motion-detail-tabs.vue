<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const view = String(route.query.view ?? 'detail')
const analysisTab = shallowRef<'telemetry' | 'charts' | 'analysis' | 'improvement'>('telemetry')
const ballotReady = shallowRef(false)
const session = useSessionStore()
onMounted(() => {
	if (view !== 'voting') return
	session.setUser({ id: 42, steamId: '76561198000000042', steamName: 'Tab fixture' })
	ballotReady.value = true
})
const active = shallowRef(String(route.query.tab ?? 'career'))
const longLabels = shallowRef(false)
const items = computed(() =>
	[
		{ value: 'career', label: t('users.profile.tabs.career') },
		{ value: 'records', label: t('users.profile.tabs.records') },
		{ value: 'workshop', label: t('users.profile.tabs.workshopLevels') },
		{ value: 'favourites', label: t('users.profile.tabs.favouriteLevels') },
	].map((item) => ({
		...item,
		label: longLabels.value ? `${item.label} — weitere Details` : item.label,
	})),
)
</script>

<template>
	<UContainer class="py-4">
		<template v-if="view === 'detail'">
		<button type="button" @click="active = 'favourites'">Select favourites externally</button>
		<button type="button" @click="longLabels = !longLabels">Toggle long labels</button>
		<DetailSectionTabs v-model="active" :items="items" label="Profile sections">
			<template v-for="item in items" :key="item.value" #[item.value]>
				<label>{{ item.value }} input <input :aria-label="`${item.value} input`" /></label>
			</template>
		</DetailSectionTabs>
		</template>
		<RecordAnalysisTabs v-else-if="view === 'analysis'" v-model="analysisTab" :labels="{
			label: 'Record analysis', telemetry: 'Telemetry', charts: 'Telemetry Charts',
			analysis: 'Detailed Analysis', improvement: 'Improvement Suggestions',
		}">
			<template #telemetry><input aria-label="Telemetry input" /></template>
			<template #charts><p>Charts panel</p></template>
			<template #analysis><p>Analysis panel</p></template>
			<template #improvement><p>Improvement panel</p></template>
		</RecordAnalysisTabs>
		<ContentCodeGroup v-else-if="view === 'code'" title="Code examples"
			curl-label="cURL command" typescript-label="TypeScript / JavaScript" python-label="Python example">
			<template #curl><input aria-label="cURL input" /></template>
			<template #typescript><p>TypeScript panel</p></template>
			<template #python><p>Python panel</p></template>
		</ContentCodeGroup>
		<VotingBallot v-else-if="view === 'voting' && ballotReady" />
		<div class="h-[150vh]" />
	</UContainer>
</template>

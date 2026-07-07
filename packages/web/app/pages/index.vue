<template>
	<UContainer class="py-2">
		<PageHeader
			:eyebrow="$t('pages.home.eyebrow')"
			:title="$t('pages.home.title')"
			:description="$t('pages.home.description')"
		/>

		<div class="grid gap-4 md:grid-cols-3">
			<StatCard
				icon="map"
				:label="$t('home.stats.levels')"
				:value="stats.levels"
			/>
			<StatCard
				icon="users"
				:label="$t('home.stats.players')"
				:value="stats.players"
			/>
			<StatCard
				icon="trophy"
				:label="$t('home.stats.records')"
				:value="stats.records"
			/>
		</div>

		<UCard class="mt-4 rounded-lg border-border bg-card/80">
			<div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
				<div>
					<h2 class="text-2xl font-semibold">
						{{ $t('home.portal.title') }}
					</h2>
					<p class="mt-2 text-muted-foreground">
						{{ $t('home.portal.description') }}
					</p>
				</div>
				<ExternalPromos />
			</div>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
import { useQuery } from '@urql/vue'
import ZcHomeStatsQuery from '~/graphql/queries/homeStats.graphql'

usePageSeo('home')

const { data } = useQuery({ query: ZcHomeStatsQuery })

const numberFormat = new Intl.NumberFormat()
const stats = computed(() => ({
	levels: numberFormat.format(data.value?.levels?.totalCount ?? 0),
	players: numberFormat.format(data.value?.users?.totalCount ?? 0),
	records: numberFormat.format(data.value?.records?.totalCount ?? 0),
}))
</script>

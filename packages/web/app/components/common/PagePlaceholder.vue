<template>
	<UContainer class="py-2">
		<PageHeader
			:eyebrow="$t(`pages.${pageKey}.eyebrow`)"
			:title="$t(`pages.${pageKey}.title`)"
			:description="$t(`pages.${pageKey}.description`)"
		/>

		<div class="grid gap-4 md:grid-cols-3">
			<UCard
				v-for="metric in metrics"
				:key="metric"
				:ui="{ root: 'rounded-lg border-border bg-card/80' }"
			>
				<div class="flex items-center gap-3">
					<TablerIcon :name="icon" class="text-primary" />
					<div>
						<p class="text-sm text-muted-foreground">
							{{ $t(`placeholders.metrics.${metric}.label`) }}
						</p>
						<p class="tabular text-2xl font-semibold">
							{{ $t(`placeholders.metrics.${metric}.value`) }}
						</p>
					</div>
				</div>
			</UCard>
		</div>

		<UCard class="mt-4 rounded-lg border-border bg-card/80">
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 class="text-xl font-semibold">
						{{ $t(`pages.${pageKey}.panelTitle`) }}
					</h2>
					<p class="text-muted-foreground">
						{{ $t(`pages.${pageKey}.panelDescription`) }}
					</p>
				</div>
				<UBadge color="primary" variant="soft">
					{{ $t('common.placeholder') }}
				</UBadge>
			</div>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
defineProps<{
	pageKey: string
	icon: string
}>()

const metrics = ['records', 'players', 'levels'] as const
</script>

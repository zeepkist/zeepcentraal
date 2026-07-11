<template>
	<UContainer class="py-2">
		<PageHeader
			:eyebrow="$t('pages.records.eyebrow')"
			:title="$t('pages.records.title')"
			:description="$t('pages.records.description')"
		/>

		<UCard class="rounded-lg border-border bg-card/80">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 id="live-record-heading" class="text-xl font-semibold">
						{{ $t('pages.records.live.title') }}
					</h2>
					<p class="mt-1 text-muted-foreground">
						{{ $t('pages.records.live.description') }}
					</p>
				</div>
				<UBadge :color="status.color" variant="soft" role="status">
					{{ status.label }}
				</UBadge>
			</div>

			<div aria-labelledby="live-record-heading" aria-live="polite" class="mt-6">
				<UAlert
					v-if="error"
					color="error"
					icon="i-lucide-circle-alert"
					:title="$t('pages.records.live.error')"
					:description="error.message"
				/>

				<p v-else-if="!latestRecord" class="text-muted-foreground">
					{{ $t('pages.records.live.waiting') }}
				</p>

				<dl v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<div v-for="field in recordFields" :key="field.key">
						<dt class="text-sm text-muted-foreground">
							{{ $t(`pages.records.live.fields.${field.key}`) }}
						</dt>
						<dd class="mt-1 break-all font-medium tabular-nums">
							{{ field.value }}
						</dd>
					</div>
				</dl>
			</div>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
usePageSeo('records')

const { data, error, fetching } = useRecordUpdates()
const { t } = useI18n()

const latestRecord = computed(() => data.value?.records?.nodes[0])
const status = computed(() => {
	if (error.value) {
		return { color: 'error' as const, label: t('pages.records.live.status.error') }
	}

	if (fetching.value) {
		return { color: 'success' as const, label: t('pages.records.live.status.listening') }
	}

	return { color: 'neutral' as const, label: t('pages.records.live.status.connecting') }
})
const recordFields = computed(() => {
	const record = latestRecord.value
	if (!record) {
		return []
	}

	return [
		{ key: 'id', value: record.id },
		{ key: 'levelId', value: record.levelId },
		{ key: 'userId', value: record.userId },
		{ key: 'time', value: record.time },
		{ key: 'dateCreated', value: record.dateCreated },
	]
})
</script>

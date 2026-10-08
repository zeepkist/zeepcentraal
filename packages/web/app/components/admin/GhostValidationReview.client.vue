<script setup vapor lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { type ValidationAttempt, validationCsv } from '~~/shared/ghostValidation'

const attempts = shallowRef<ValidationAttempt[]>([])
const recordFilter = shallowRef('')
const status = shallowRef('all')
const selectedRecord = shallowRef<number | null>(null)
const busy = shallowRef(false)
const error = shallowRef('')
const auditMessage = shallowRef('')
const auditLevel = shallowRef('')
const auditWorkshop = shallowRef('')
const auditFrom = shallowRef('')
const auditTo = shallowRef('')
const formState = computed(() => ({ record: recordFilter.value, status: status.value, level: auditLevel.value, workshop: auditWorkshop.value, from: auditFrom.value, to: auditTo.value }))
const statusItems = [
	{ label: 'All statuses', value: 'all' },
	{ label: 'Pending', value: 'pending' },
	{ label: 'Pass', value: 'pass' },
	{ label: 'Fail', value: 'fail' },
	{ label: 'Uncertain', value: 'uncertain' },
]
const columns: TableColumn<ValidationAttempt>[] = [
	{ accessorKey: 'id', header: 'Validation' },
	{ accessorKey: 'id_record', header: 'Record' },
	{ accessorKey: 'status', header: 'Status' },
	{ id: 'reasons', header: 'Reasons' },
	{ accessorKey: 'updated_at', header: 'Observed' },
	{ accessorKey: 'validator_version', header: 'Validator' },
	{ id: 'review', header: 'Review' },
]

async function load(more = false) {
	busy.value = true; error.value = ''
	try {
		const page = await $fetch<{ attempts: ValidationAttempt[] }>('/api/admin/ghost-validation', { query: { after: more ? attempts.value.at(-1)?.id : '0', record: recordFilter.value || undefined, status: status.value === 'all' ? undefined : status.value, idLevel: auditLevel.value || undefined, workshopId: auditWorkshop.value || undefined, from: auditFrom.value ? new Date(auditFrom.value).toISOString() : undefined, to: auditTo.value ? new Date(auditTo.value).toISOString() : undefined } })
		attempts.value = more ? [...attempts.value, ...page.attempts] : page.attempts
	} catch (e) { error.value = e instanceof Error ? e.message : 'Review unavailable' }
	finally { busy.value = false }
}
async function audit() {
	busy.value = true; error.value = ''; auditMessage.value = ''
	try {
		await $fetch('/api/admin/ghost-validation/audit', { method: 'POST', body: {
			...(recordFilter.value ? { idRecord: Number(recordFilter.value) } : {}),
			...(auditLevel.value ? { idLevel: Number(auditLevel.value) } : {}),
			...(auditWorkshop.value ? { workshopId: auditWorkshop.value } : {}),
			...(auditFrom.value ? { from: new Date(auditFrom.value).toISOString() } : {}),
			...(auditTo.value ? { to: new Date(auditTo.value).toISOString() } : {}),
		} })
		auditMessage.value = 'Audit queued. Records remain eligible. Refresh to see results.'
	} catch (e) { error.value = e instanceof Error ? e.message : 'Audit unavailable' }
	finally { busy.value = false }
}
function download(format: 'json' | 'csv') {
	const contents = format === 'json' ? JSON.stringify(attempts.value, null, 2) : validationCsv(attempts.value)
	const url = URL.createObjectURL(new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }))
	const link = document.createElement('a'); link.href = url; link.download = `ghost-validation.${format}`; link.click()
	URL.revokeObjectURL(url)
}
onMounted(() => load())
</script>

<template>
	<div class="space-y-6">
		<UCard class="rounded-xl border-border bg-card/85">
			<template #header><h2 class="font-semibold">Review filters</h2></template>
			<UForm :state="formState" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" @submit="load()">
				<UFormField label="Record ID" name="record">
					<UInput :model-value="recordFilter" type="number" :min="1" placeholder="All records" class="w-full" @update:model-value="recordFilter = String($event ?? '')" />
				</UFormField>
				<UFormField label="Status" name="status">
					<USelect v-model="status" :items="statusItems" class="w-full" />
				</UFormField>
				<UFormField label="Level ID" name="level">
					<UInput :model-value="auditLevel" type="number" :min="1" placeholder="All levels" class="w-full" @update:model-value="auditLevel = String($event ?? '')" />
				</UFormField>
				<UFormField label="Workshop ID" name="workshop">
					<UInput v-model="auditWorkshop" inputmode="numeric" placeholder="All workshop items" class="w-full" />
				</UFormField>
				<UFormField label="From" name="from"><UInput v-model="auditFrom" type="datetime-local" class="w-full" /></UFormField>
				<UFormField label="Before" name="to"><UInput v-model="auditTo" type="datetime-local" class="w-full" /></UFormField>
				<div class="sm:col-span-2 lg:col-span-3"><UButton type="submit" :loading="busy">Refresh</UButton></div>
			</UForm>
		</UCard>
		<UAlert v-if="error" color="error" variant="soft" title="Review unavailable" :description="error" />
		<UCard class="rounded-xl border-border bg-card/85">
			<template #header>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="font-semibold">Validation results</h2>
					<div class="flex flex-wrap gap-2">
						<UButton color="neutral" variant="outline" @click="download('json')">Export loaded JSON</UButton>
						<UButton color="neutral" variant="outline" @click="download('csv')">Export loaded CSV</UButton>
					</div>
				</div>
			</template>
			<UTable :data="attempts" :columns="columns" :loading="busy" empty="No validation results found.">
				<template #status-cell="{ row }">
					<div class="flex items-center gap-2">
						<UBadge :color="row.original.status === 'pass' ? 'success' : row.original.status === 'fail' ? 'error' : row.original.status === 'uncertain' ? 'warning' : 'neutral'" variant="soft">{{ row.original.status }}</UBadge>
					</div>
				</template>
				<template #reasons-cell="{ row }"><span class="whitespace-normal">{{ row.original.report.reasons.join(', ') || '—' }}</span></template>
				<template #review-cell="{ row }"><UButton v-if="row.original.id_record" color="neutral" variant="ghost" @click="selectedRecord = row.original.id_record">Compare</UButton></template>
			</UTable>
			<template #footer><UButton color="neutral" variant="outline" :loading="busy" @click="load(true)">Load more results</UButton></template>
		</UCard>
		<GhostValidationComparison v-if="selectedRecord" :record-id="selectedRecord" :attempts="attempts" />
		<UCard class="rounded-xl border-border bg-card/85">
			<template #header><h2 class="font-semibold">Queue historical audit</h2></template>
			<UForm :state="formState" class="space-y-4" @submit="audit">
				<p class="text-sm text-muted">Uses review filters above. Empty filters audit all records. Dates, scores, and eligibility remain unchanged.</p>
				<UButton type="submit" :loading="busy">Queue audit</UButton>
				<UAlert v-if="auditMessage" color="success" variant="soft" title="Audit queued" :description="auditMessage" role="status" />
			</UForm>
		</UCard>
	</div>
</template>

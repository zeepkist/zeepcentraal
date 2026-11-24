<script setup lang="ts">
import { parseWorkshopId } from '#shared/workshopId'

const { t } = useAppI18n()
const open = shallowRef(false)
const input = shallowRef('')
const submittedId = shallowRef<string>()
const pending = shallowRef(false)
const invalid = shallowRef(false)
const failed = shallowRef(false)

function setOpen(value: boolean) {
	if (pending.value) return
	if (value) {
		input.value = ''
		submittedId.value = undefined
		invalid.value = false
		failed.value = false
	}
	open.value = value
}

async function submit() {
	if (pending.value || submittedId.value) return
	failed.value = false
	const workshopId = parseWorkshopId(input.value)
	invalid.value = workshopId === null
	if (!workshopId) return

	pending.value = true
	try {
		await $fetch('/api/workshop/request-scan', {
			method: 'POST',
			body: { workshopId },
			retry: 0,
		})
		submittedId.value = workshopId
	} catch {
		failed.value = true
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<UModal :open="open" :dismissible="!pending" :close="!pending" :title="t('workshop.scan.title')" @update:open="setOpen">
		<UButton block color="neutral" variant="outline">{{ t('workshop.scan.title') }}</UButton>
		<template #body>
			<div v-if="submittedId" class="space-y-4">
				<p role="status">{{ t('workshop.scan.confirmation') }}</p>
				<UButton :to="`/workshop/${submittedId}`">{{ t('workshop.scan.open') }}</UButton>
			</div>
			<form v-else class="space-y-4" novalidate @submit.prevent="submit">
				<UFormField :label="t('workshop.scan.link')" :error="invalid ? t('workshop.scan.invalid') : undefined" required>
					<UInput v-model="input" type="text" class="w-full" :disabled="pending" @update:model-value="invalid = false" />
				</UFormField>
				<p v-if="failed" role="alert" class="text-sm text-error">{{ t('workshop.scan.failed') }}</p>
				<UButton type="submit" :loading="pending">{{ t('workshop.scan.submit') }}</UButton>
			</form>
		</template>
	</UModal>
</template>

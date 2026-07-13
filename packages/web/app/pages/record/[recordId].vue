<template>
	<UContainer class="py-2">
		<UCard
			class="relative overflow-hidden rounded-2xl border-primary/25 bg-linear-to-br from-primary/15 via-card to-card"
		>
			<div class="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
			<div class="relative max-w-2xl">
				<span class="grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
					<TablerIcon name="flag" class="size-6" />
				</span>
				<h1 class="mt-5 text-4xl font-black">{{ $t('pages.recordDetail.title') }}</h1>
				<p class="mt-3 text-lg text-muted-foreground">
					{{ $t('pages.recordDetail.description', { id: recordId }) }}
				</p>
				<UButton to="/records" class="mt-6" color="primary" variant="soft">
					<TablerIcon name="arrow-left" class="size-4" />
					{{ $t('pages.recordDetail.back') }}
				</UButton>
			</div>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const rawRecordId = route.params.recordId
const recordId =
	typeof rawRecordId === 'string' && /^\d+$/.test(rawRecordId) ? Number(rawRecordId) : null
if (recordId === null || !Number.isSafeInteger(recordId) || recordId < 1) {
	throw createError({
		statusCode: 404,
		statusMessage: t('pages.recordDetail.notFound'),
	})
}

useSeoMeta({
	title: () => t('pages.recordDetail.seo.title', { id: recordId }),
	description: () => t('pages.recordDetail.seo.description'),
	robots: 'noindex, nofollow',
})
</script>

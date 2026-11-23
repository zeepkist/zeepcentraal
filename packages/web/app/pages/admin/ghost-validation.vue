<script setup lang="ts">
const { t } = useAppI18n()
useSeoMeta({ title: () => t('auth.ghostValidation'), robots: 'noindex, nofollow' })
</script>

<template>
	<PageContainer class="space-y-8 py-2">
		<PageHeader :title="t('auth.ghostValidation')" description="Review validation results, compare level versions, and queue historical audits." />
		<GhostValidationReview />
	</PageContainer>
</template>

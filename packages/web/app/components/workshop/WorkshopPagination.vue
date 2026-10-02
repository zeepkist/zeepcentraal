<script setup vapor lang="ts">
import type { CursorPage } from '~/types/app'

defineProps<{
	page: CursorPage
	pagination: ReturnType<typeof useCursorPagination>
	pending: boolean
}>()
</script>

<template>
	<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="pending" :label="$t('common.pagination')" :loading-label="$t('common.loading')" :first-label="$t('common.first')" :previous-label="$t('common.previous')" :next-label="$t('common.next')" :last-label="$t('common.last')" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
</template>

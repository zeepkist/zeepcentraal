<script setup vapor lang="ts">
import type { WorkshopSummary } from '~/types/app'
import { formatWorkshopFileSize } from '~/utils/workshop'

const props = defineProps<{ workshop: WorkshopSummary }>()
const { locale } = useI18n()
const fileSize = computed(() => formatWorkshopFileSize(props.workshop.fileSize, locale.value))
</script>

<template>
	<article class="group h-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1" :data-workshop-id="workshop.workshopId">
		<NuxtLink :to="`/workshop/${workshop.workshopId}`" class="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
			<div class="grid aspect-video place-items-center overflow-hidden rounded-lg bg-muted">
				<NuxtImg v-if="workshop.imageUrl" :src="workshop.imageUrl" :alt="workshop.name" width="1600" height="900" sizes="100vw sm:50vw xl:33vw 2xl:25vw" class="size-full object-cover transition duration-300 motion-safe:group-hover:scale-105" loading="lazy" />
				<TablerIcon v-else name="map" class="size-10 text-muted-foreground" />
			</div>
			<div class="mt-4 flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="truncate text-lg font-semibold text-highlighted" :title="workshop.name">{{ workshop.name }}</h3>
					<p class="truncate text-sm text-muted-foreground">{{ workshop.authorName || $t('common.unknownAuthor') }}</p>
				</div>
				<TablerIcon name="chevron-right" class="size-5 shrink-0 text-muted-foreground" />
			</div>
			<dl class="mt-4 space-y-2 text-sm">
				<div class="flex flex-wrap justify-between gap-x-3">
					<dt class="text-muted-foreground">{{ $t('workshop.published') }}</dt>
					<dd><NuxtTime :datetime="workshop.createdAt" :locale="locale" day="numeric" month="short" year="numeric" /></dd>
				</div>
				<div class="flex flex-wrap justify-between gap-x-3">
					<dt class="text-muted-foreground">{{ $t('workshop.updated') }}</dt>
					<dd><NuxtTime :datetime="workshop.updatedAt" :locale="locale" day="numeric" month="short" year="numeric" /></dd>
				</div>
				<div class="flex flex-wrap justify-between gap-x-3">
					<dt class="text-muted-foreground">{{ $t('workshop.fileSize') }}</dt>
					<dd class="tabular-nums">{{ fileSize }}</dd>
				</div>
			</dl>
		</NuxtLink>
	</article>
</template>

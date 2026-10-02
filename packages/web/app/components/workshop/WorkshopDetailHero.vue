<script setup vapor lang="ts">
import type { WorkshopSummary } from '~/types/app'
import { formatWorkshopFileSize } from '~/utils/workshop'

const props = defineProps<{ workshop: WorkshopSummary }>()
const { locale } = useI18n()
const fileSize = computed(() => formatWorkshopFileSize(props.workshop.fileSize, locale.value))
</script>

<template>
	<section class="grid gap-6 rounded-2xl border border-border bg-card/70 p-4 sm:p-6 lg:grid-cols-2" aria-labelledby="workshop-title">
		<div class="grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted">
			<NuxtImg v-if="workshop.imageUrl" :src="workshop.imageUrl" :alt="workshop.name" width="1600" height="900" sizes="100vw lg:50vw" class="size-full object-cover" loading="eager" fetchpriority="high" />
			<TablerIcon v-else name="map" class="size-12 text-muted-foreground" />
		</div>
		<div class="min-w-0 space-y-5">
			<div>
				<p class="text-sm font-semibold text-primary">{{ $t('pages.workshop.eyebrow') }}</p>
				<h1 id="workshop-title" class="mt-2 break-words text-3xl font-bold text-highlighted">{{ workshop.name }}</h1>
				<NuxtLink :to="`/user/${workshop.authorSteamId}`" class="mt-2 inline-block text-muted-foreground hover:text-primary">{{ workshop.authorName || $t('common.unknownAuthor') }}</NuxtLink>
			</div>
			<dl class="grid gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-sm text-muted-foreground">{{ $t('workshop.id') }}</dt>
					<dd class="break-all font-mono tabular-nums">{{ workshop.workshopId }}</dd>
				</div>
				<div>
					<dt class="text-sm text-muted-foreground">{{ $t('workshop.fileSize') }}</dt>
					<dd class="tabular-nums">{{ fileSize }}</dd>
				</div>
				<div>
					<dt class="text-sm text-muted-foreground">{{ $t('workshop.published') }}</dt>
					<dd><NuxtTime :datetime="workshop.createdAt" :locale="locale" day="numeric" month="long" year="numeric" /></dd>
				</div>
				<div>
					<dt class="text-sm text-muted-foreground">{{ $t('workshop.updated') }}</dt>
					<dd><NuxtTime :datetime="workshop.updatedAt" :locale="locale" day="numeric" month="long" year="numeric" /></dd>
				</div>
			</dl>
			<UButton :to="`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshop.workshopId}`" target="_blank" rel="noopener noreferrer" color="primary">{{ $t('workshop.viewOnSteam') }}</UButton>
		</div>
	</section>
</template>

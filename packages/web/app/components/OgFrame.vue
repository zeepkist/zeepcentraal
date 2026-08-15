<template>
	<div
		class="relative flex size-full overflow-hidden bg-warm-neutral-950 text-warm-neutral-50"
		style="font-family: DINish; font-style: normal; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
	>
		<div class="absolute inset-x-0 top-0 h-2 bg-[#facc15]" />

		<div class="relative flex size-full flex-col px-14 pb-10 pt-9">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<img
						src="/android-chrome-192x192.png"
						alt=""
						class="h-16 w-16 object-contain"
					/>
					<div class="text-[30px] font-black tracking-tight text-[#facc15]">
						{{ $t('common.brand') }}
					</div>
				</div>
				<div
					v-if="eyebrow"
					class="rounded-full border border-warm-neutral-700 bg-warm-neutral-900 px-5 py-2 text-[20px] font-bold uppercase tracking-[0.12em] text-warm-neutral-300"
				>
					{{ eyebrow }}
				</div>
			</div>

			<div :class="dense ? 'mt-6' : 'mt-8'" class="flex min-h-0 flex-1 gap-10">
				<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div
						:class="dense ? 'h-28 shrink-0 overflow-hidden' : 'min-h-0'"
						class="flex min-w-0 flex-col"
					>
						<h1
							:class="
								dense
									? 'overflow-hidden text-ellipsis whitespace-nowrap text-[52px]'
									: 'max-h-38 overflow-hidden text-[62px]'
							"
							class="m-0 font-black leading-[1.04] tracking-[-0.035em] tabular-nums"
							style="font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
						>
							{{ title }}
						</h1>
						<p
							v-if="description"
							:class="dense ? 'mt-2 max-h-14 text-[22px]' : 'mt-4 max-h-21 text-[26px]'"
							class="m-0 overflow-hidden leading-[1.3] text-warm-neutral-400"
						>
							{{ description }}
						</p>
					</div>
					<div
						:class="dense ? 'mt-3' : 'mt-6'"
						class="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden"
					>
						<slot />
					</div>
				</div>

				<div
					v-if="resolvedImageUrl"
					class="flex w-100 shrink-0 overflow-hidden rounded-3xl border border-warm-neutral-700 bg-warm-neutral-900 p-2"
				>
					<img :src="resolvedImageUrl" alt="" class="size-full rounded-2xl object-cover" />
				</div>
			</div>

			<div :class="dense ? 'mt-5' : 'mt-7'" class="flex items-center gap-4">
				<div class="h-1 flex-1 rounded-full bg-warm-neutral-800" />
				<div class="text-[18px] font-bold tracking-[0.08em] text-warm-neutral-500">ZEEPKI.ST</div>
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import { computed } from 'vue'
import { normaliseOgImageUrl } from '~/utils/ogImage'

const props = defineProps<{
	dense?: boolean
	description?: string
	eyebrow?: string
	imageUrl?: string
	title: string
}>()

const resolvedImageUrl = computed(() => normaliseOgImageUrl(props.imageUrl))
</script>

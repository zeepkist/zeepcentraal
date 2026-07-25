<template>
	<div
		class="relative flex size-full flex-col justify-center overflow-hidden bg-warm-neutral-950 px-18 text-warm-neutral-50"
	>
		<div
			class="absolute inset-0"
			style="background-image: radial-gradient(circle at 85% 20%, rgba(250, 204, 21, 0.2), transparent 38%), radial-gradient(circle at 10% 90%, rgba(250, 204, 21, 0.1), transparent 32%)"
		/>
		<div class="relative flex flex-col gap-8">
			<div class="flex items-center gap-4 text-[30px] font-bold tracking-tight text-[#facc15]">
				<span class="h-3 w-16 rounded-full bg-[#facc15]" />
				<span>{{ brand }}</span>
			</div>
			<h1 class="m-0 max-w-262.5 text-[68px] font-black leading-[1.05] tracking-tight">
				{{ title }}
			</h1>
			<p
				v-if="description"
				class="m-0 max-w-245 text-[28px] leading-[1.35] text-warm-neutral-300"
			>
				{{ description }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	brand: string
	description?: string
	title: string
}>()
</script>

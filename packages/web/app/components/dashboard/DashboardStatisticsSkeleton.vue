<template>
	<div class="space-y-6">
		<div class="grid gap-4 md:grid-cols-3">
			<USkeleton v-for="index in 3" :key="index" class="h-32 rounded-2xl" />
		</div>
		<USkeleton class="h-24 rounded-2xl" />
		<div class="grid gap-5 xl:grid-cols-2">
			<USkeleton v-for="index in 4" :key="index" class="h-96 rounded-2xl" />
		</div>
		<div class="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
			<USkeleton class="h-48 rounded-2xl" />
			<USkeleton class="h-48 rounded-2xl" />
		</div>
	</div>
</template>

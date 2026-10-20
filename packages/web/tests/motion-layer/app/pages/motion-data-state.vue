<script setup lang="ts">
const route = useRoute()
const pending = shallowRef(route.query.mode !== 'ready')
const initialReveal = shallowRef(route.query.mode !== 'default')
const error = shallowRef<string | null>(null)
const empty = shallowRef(false)
const visible = shallowRef(true)
const revision = shallowRef(0)
const controls = {
	async settle(result = 'success') {
		await Promise.resolve()
		error.value = result === 'error' ? 'Fixture error' : null
		empty.value = result === 'empty'
		pending.value = false
		await nextTick()
	},
	async pending() {
		pending.value = true
		await nextTick()
	},
	async change(action: string) {
		if (action === 'opt-out') initialReveal.value = false
		if (action === 'unmount') visible.value = false
		if (action === 'update') revision.value++
		if (action === 'error') error.value = 'Fixture error'
		if (action === 'empty') empty.value = true
		await nextTick()
	},
	async interrupt() {
		pending.value = false
		await nextTick()
		pending.value = true
		await nextTick()
	},
}
onMounted(() => {
	Object.assign(window, { dataStateFixture: controls })
})
onScopeDispose(() => {
	if (import.meta.client) Reflect.deleteProperty(window, 'dataStateFixture')
})
</script>

<template>
	<main class="p-4">
		<label>Focus sentinel <input aria-label="Focus sentinel" /></label>
		<DataState
			v-if="visible"
			data-testid="fixture-state"
			:pending="pending"
			:initial-reveal="initialReveal"
			:error="error"
			:empty="empty"
			loading-label="Fixture loading"
			error-title="Fixture failed"
			empty-title="Fixture empty"
			:skeletons="1"
		>
			<div data-testid="fixture-content">
				<p>Content revision {{ revision }}</p>
				<label>Content input <input aria-label="Content input" /></label>
				<a href="#fixture-destination">Fixture link</a>
			</div>
		</DataState>
		<div id="fixture-destination">Destination</div>
	</main>
</template>

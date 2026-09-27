<script setup vapor lang="ts">
const emit = defineEmits<{ token: [token: string | null] }>()
const config = useRuntimeConfig()
const widget = useTemplateRef<HTMLDivElement>('widget')
const error = ref(false)
let widgetId: string | undefined
let disposed = false

onMounted(async () => {
	for (let attempt = 0; attempt < 50 && !window.turnstile; attempt++)
		await new Promise((resolve) => setTimeout(resolve, 200))
	if (disposed || !widget.value || !window.turnstile) { error.value = true; return }
	widgetId = window.turnstile.render(widget.value, {
		sitekey: String(config.public.turnstileSiteKey),
		action: 'zsl-vote',
		appearance: 'always',
		theme: 'auto',
		size: 'flexible',
		callback: (token: string) => emit('token', token),
		'error-callback': () => { error.value = true; emit('token', null) },
		'expired-callback': () => emit('token', null),
	})
})

onScopeDispose(() => {
	disposed = true
	if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})
</script>

<template>
	<div ref="widget" class="cf-turnstile min-h-16 max-w-96" />
	<p v-if="error" role="alert" class="text-sm text-error">Verification unavailable. Reload page.</p>
</template>

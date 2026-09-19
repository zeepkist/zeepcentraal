<script setup vapor lang="ts">
const emit = defineEmits<{ verified: [] }>()
const { t } = useI18n()
const config = useRuntimeConfig()
const widget = useTemplateRef<HTMLDivElement>('widget')
const status = shallowRef<'loading' | 'ready' | 'verifying' | 'error'>('loading')
let widgetId: string | undefined
let disposed = false

onMounted(async () => {
	try {
		const turnstile = await loadTurnstile()
		if (disposed || !widget.value) return
		widgetId = turnstile.render(widget.value, {
			sitekey: String(config.public.turnstileSiteKey),
			action: 'record-replay',
			appearance: 'always',
			theme: 'auto',
			size: 'flexible',
			callback: verify,
			'error-callback': () => {
				status.value = 'error'
			},
			'expired-callback': () => {
				status.value = 'ready'
			},
		})
		status.value = 'ready'
	} catch {
		status.value = 'error'
	}
})

onScopeDispose(() => {
	disposed = true
	if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})

async function verify(token: string) {
	if (status.value === 'verifying') return
	status.value = 'verifying'
	try {
		const result = await $fetch<{ success: boolean }>(
			new URL('/turnstile/verify', String(config.public.backendUrl)).toString(),
			{
				method: 'POST',
				body: { token },
				credentials: 'omit',
			},
		)
		if (!result.success) throw new Error('Turnstile verification failed')
		emit('verified')
	} catch {
		status.value = 'error'
		if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
	}
}

let turnstilePromise: Promise<TurnstileApi> | undefined

function loadTurnstile(): Promise<TurnstileApi> {
	if (window.turnstile) return Promise.resolve(window.turnstile)
	if (turnstilePromise) return turnstilePromise

	turnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.querySelector<HTMLScriptElement>(
			'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
		)
		if (!script) {
			reject(new Error('Turnstile script is missing'))
			return
		}
		const scriptElement = script

		let timeout = 0
		function finish() {
			window.clearTimeout(timeout)
			scriptElement.removeEventListener('load', finish)
			scriptElement.removeEventListener('error', fail)
			if (window.turnstile) resolve(window.turnstile)
			else reject(new Error('Turnstile failed to load'))
		}
		const fail = () => finish()
		timeout = window.setTimeout(finish, 10_000)
		scriptElement.addEventListener('load', finish, { once: true })
		scriptElement.addEventListener('error', fail, { once: true })
		if (window.turnstile) finish()
	}).catch((error) => {
		turnstilePromise = undefined
		throw error
	})

	return turnstilePromise
}
</script>

<template>
	<section
		class="rounded-2xl border border-border bg-card/60 px-6 py-8 text-center"
		aria-labelledby="turnstile-heading"
	>
		<TablerIcon name="shield-check" class="mx-auto size-10 text-primary" />
		<h2 id="turnstile-heading" class="mt-3 text-lg font-semibold">
			{{ t('pages.recordDetail.turnstile.title') }}
		</h2>
		<p class="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
			{{ t('pages.recordDetail.turnstile.description') }}
		</p>
		<div
			ref="widget"
			class="cf-turnstile mx-auto mt-5 min-h-16 max-w-96"
			:data-sitekey="String(config.public.turnstileSiteKey)"
		/>
		<p v-if="status === 'verifying'" class="mt-3 text-sm text-muted-foreground" role="status">
			{{ t('pages.recordDetail.turnstile.verifying') }}
		</p>
		<p v-else-if="status === 'error'" class="mt-3 text-sm text-error" role="alert">
			{{ t('pages.recordDetail.turnstile.error') }}
		</p>
	</section>
</template>

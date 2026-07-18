import type { GhostFrameRate, GhostPerformancePreferences, GhostRenderQuality } from '~/types/ghost'
import {
	clearGhostBinaryCache,
	type GhostBinaryCacheStats,
	getGhostBinaryCacheStats,
} from '~/utils/ghostBinaryCache.client'

const DEFAULT_PREFERENCES: GhostPerformancePreferences = {
	version: 1,
	frameRate: 'auto',
	renderQuality: 'auto',
}

export function useGhostPerformancePreferences() {
	const cookie = useCookie<GhostPerformancePreferences>('ghost-performance', {
		default: () => ({ ...DEFAULT_PREFERENCES }),
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		path: '/',
	})
	const mobile = ref(false)
	const cacheStats = shallowRef<GhostBinaryCacheStats | null>(null)
	const cachePending = ref(false)

	onMounted(() => {
		const navigatorWithUserAgentData = globalThis.navigator as Navigator & {
			userAgentData?: { mobile?: boolean }
		}
		mobile.value =
			navigatorWithUserAgentData.userAgentData?.mobile === true ||
			globalThis.matchMedia?.('(pointer: coarse)').matches === true
		void refreshCacheStats()
	})

	const preferences = computed(() => sanitizePreferences(cookie.value))
	const frameRate = computed<30 | 60>(() => {
		const selected = preferences.value.frameRate
		return selected === 'auto' ? (mobile.value ? 30 : 60) : selected
	})
	const renderQuality = computed<Exclude<GhostRenderQuality, 'auto'>>(() => {
		const selected = preferences.value.renderQuality
		return selected === 'auto' ? (mobile.value ? 'balanced' : 'quality') : selected
	})

	function setFrameRate(value: GhostFrameRate) {
		cookie.value = { ...preferences.value, frameRate: value }
	}

	function setRenderQuality(value: GhostRenderQuality) {
		cookie.value = { ...preferences.value, renderQuality: value }
	}

	async function refreshCacheStats() {
		if (import.meta.server) return
		cachePending.value = true
		try {
			cacheStats.value = await getGhostBinaryCacheStats()
		} finally {
			cachePending.value = false
		}
	}

	async function clearCache() {
		if (import.meta.server) return
		cachePending.value = true
		try {
			await clearGhostBinaryCache()
			cacheStats.value = await getGhostBinaryCacheStats()
		} finally {
			cachePending.value = false
		}
	}

	return {
		preferences,
		frameRate,
		renderQuality,
		cacheStats,
		cachePending,
		setFrameRate,
		setRenderQuality,
		refreshCacheStats,
		clearCache,
	}
}

function sanitizePreferences(value: unknown): GhostPerformancePreferences {
	if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES }
	const candidate = value as Partial<GhostPerformancePreferences>
	const frameRate: GhostFrameRate =
		candidate.frameRate === 30 || candidate.frameRate === 60 || candidate.frameRate === 'auto'
			? candidate.frameRate
			: 'auto'
	const renderQuality: GhostRenderQuality = [
		'auto',
		'performance',
		'balanced',
		'quality',
	].includes(String(candidate.renderQuality))
		? (candidate.renderQuality as GhostRenderQuality)
		: 'auto'
	return { version: 1, frameRate, renderQuality }
}

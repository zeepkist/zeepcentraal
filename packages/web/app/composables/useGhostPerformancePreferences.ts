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
	showLevelGeometry: true,
	showGhostTrails: true,
}

export function useGhostPerformancePreferences() {
	const cookie = useCookie<GhostPerformancePreferences>('ghost-performance', {
		default: () => ({ ...DEFAULT_PREFERENCES }),
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		path: '/',
	})
	const mobile = shallowRef(false)
	const cacheStats = shallowRef<GhostBinaryCacheStats | null>(null)
	const cachePending = shallowRef(false)

	onMounted(() => {
		const navigatorWithUserAgentData = globalThis.navigator as Navigator & {
			userAgentData?: { mobile?: boolean }
		}
		mobile.value =
			navigatorWithUserAgentData.userAgentData?.mobile === true ||
			globalThis.matchMedia?.('(pointer: coarse)').matches === true
		void refreshCacheStats()
	})

	const preferences = computed(() => sanitizeGhostPerformancePreferences(cookie.value))
	const frameRate = computed<30 | 60>(() =>
		resolveGhostFrameRate(preferences.value.frameRate, mobile.value),
	)
	const renderQuality = computed<Exclude<GhostRenderQuality, 'auto'>>(() =>
		resolveGhostRenderQuality(preferences.value.renderQuality, mobile.value),
	)

	function setFrameRate(value: GhostFrameRate) {
		cookie.value = { ...preferences.value, frameRate: value }
	}

	function setRenderQuality(value: GhostRenderQuality) {
		cookie.value = { ...preferences.value, renderQuality: value }
	}

	function setShowLevelGeometry(value: boolean) {
		cookie.value = { ...preferences.value, showLevelGeometry: value }
	}

	function setShowGhostTrails(value: boolean) {
		cookie.value = { ...preferences.value, showGhostTrails: value }
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
		setShowLevelGeometry,
		setShowGhostTrails,
		refreshCacheStats,
		clearCache,
	}
}

export function resolveGhostFrameRate(frameRate: GhostFrameRate, mobile: boolean): 30 | 60 {
	return frameRate === 'auto' ? (mobile ? 30 : 60) : frameRate
}

export function resolveGhostRenderQuality(
	quality: GhostRenderQuality,
	mobile: boolean,
): Exclude<GhostRenderQuality, 'auto'> {
	return quality === 'auto' ? (mobile ? 'performance' : 'quality') : quality
}

export function sanitizeGhostPerformancePreferences(value: unknown): GhostPerformancePreferences {
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
	return {
		version: 1,
		frameRate,
		renderQuality,
		showLevelGeometry: candidate.showLevelGeometry !== false,
		showGhostTrails: candidate.showGhostTrails !== false,
	}
}

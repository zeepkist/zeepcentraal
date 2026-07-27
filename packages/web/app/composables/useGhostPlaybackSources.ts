import type { MaybeRefOrGetter } from 'vue'
import type {
	GhostLoadState,
	GhostRecordSource,
	LoadedPlaybackGhost,
	ParsedPlaybackGhost,
} from '~/types/ghost'
import { buildGhostVisualIdentities, type GhostIdentityLabels } from '~/utils/ghostVisualIdentity'

export type GhostPlaybackSourceOptions = {
	sources: Ref<readonly GhostRecordSource[]>
	identityLabels: GhostIdentityLabels
	locale: Ref<string>
	primaryColor: Ref<string>
	fallbackPalette: readonly string[]
	active?: MaybeRefOrGetter<boolean>
}

export function useGhostPlaybackSources(options: GhostPlaybackSourceOptions) {
	const maximumConcurrentLoads = 3
	const config = useRuntimeConfig()
	const active = computed(() => toValue(options.active ?? true))
	const states = reactive(new Map<number, GhostLoadState>())
	const parsed = shallowReactive(new Map<number, ParsedPlaybackGhost>())
	const requested = new Map<number, string>()
	const generations = new Map<number, number>()
	const loadWaiters: Array<(acquired: boolean) => void> = []
	let activeLoads = 0
	let disposed = false

	const loaded = computed<LoadedPlaybackGhost[]>(() => {
		const inputs = options.sources.value.flatMap((record) => {
			const ghost = parsed.get(record.recordId)
			return ghost ? [{ record, ghost }] : []
		})
		const identities = buildGhostVisualIdentities(
			inputs,
			options.identityLabels,
			options.locale.value,
			options.primaryColor.value,
			options.fallbackPalette,
			options.sources.value[0]?.recordId,
		)
		const identityById = new Map(identities.map((identity) => [identity.recordId, identity]))
		return inputs.flatMap(({ record, ghost }) => {
			const identity = identityById.get(record.recordId)
			return identity ? [{ record, ghost, identity }] : []
		})
	})

	watch(
		[() => options.sources.value, active],
		([sources, isActive]) => {
			if (import.meta.server) return
			const activeIds = new Set(sources.map(({ recordId }) => recordId))
			for (const recordId of requested.keys()) {
				if (activeIds.has(recordId)) continue
				requested.delete(recordId)
				states.delete(recordId)
				parsed.delete(recordId)
				generations.set(recordId, (generations.get(recordId) ?? 0) + 1)
			}
			if (!isActive) {
				invalidatePendingLoads()
				return
			}
			for (const source of sources) {
				if (requested.get(source.recordId) !== sourceKey(source)) void load(source)
			}
		},
		{ immediate: true },
	)

	async function load(source: GhostRecordSource) {
		const key = sourceKey(source)
		const generation = (generations.get(source.recordId) ?? 0) + 1
		generations.set(source.recordId, generation)
		requested.set(source.recordId, key)
		if (!source.ghostUrl) {
			if (isCurrent(source.recordId, key, generation)) {
				states.set(source.recordId, { status: 'error', message: 'missing-ghost' })
			}
			return
		}
		states.set(source.recordId, { status: 'loading', progress: 'queued', source: null })
		if (!(await acquireLoadSlot())) return
		try {
			if (!isCurrent(source.recordId, key, generation)) return
			const { loadGhostBinary, parseGhostCdnOrigins } = await import(
				'~/utils/ghostDownload.client'
			)
			if (!isCurrent(source.recordId, key, generation)) return
			const { parseGhostInWorker } = await import('~/composables/useGhostParserWorker.client')
			if (!isCurrent(source.recordId, key, generation)) return
			states.set(source.recordId, {
				status: 'loading',
				progress: 'decompressing',
				source: null,
			})
			const result = await loadGhostBinary(
				source,
				parseGhostCdnOrigins(String(config.public.ghostCdnOrigins)),
				{
					parse: parseGhostInWorker,
				},
			)
			if (!isCurrent(source.recordId, key, generation)) return
			parsed.set(source.recordId, result.ghost)
			states.set(source.recordId, {
				status: 'loaded',
				source: result.source,
				byteLength: result.byteLength,
			})
		} catch (error) {
			if (!isCurrent(source.recordId, key, generation)) return
			states.set(source.recordId, {
				status: 'error',
				message: error instanceof Error ? error.message : String(error),
			})
		} finally {
			releaseLoadSlot()
		}
	}

	function retry(recordId: number) {
		if (!active.value) return
		const source = options.sources.value.find((candidate) => candidate.recordId === recordId)
		if (!source) return
		requested.delete(recordId)
		void load(source)
	}

	function isCurrent(recordId: number, key: string, generation: number) {
		return (
			!disposed &&
			active.value &&
			requested.get(recordId) === key &&
			generations.get(recordId) === generation
		)
	}

	async function acquireLoadSlot(): Promise<boolean> {
		if (disposed || !active.value) return false
		if (activeLoads < maximumConcurrentLoads) {
			activeLoads++
			return true
		}
		return await new Promise<boolean>((resolve) => loadWaiters.push(resolve))
	}

	function releaseLoadSlot() {
		const next = loadWaiters.shift()
		if (next) next(true)
		else activeLoads--
	}

	function invalidatePendingLoads() {
		for (const [recordId, state] of states) {
			if (state.status !== 'loading') continue
			requested.delete(recordId)
			generations.set(recordId, (generations.get(recordId) ?? 0) + 1)
			states.set(recordId, { status: 'idle' })
		}
		for (const resolve of loadWaiters.splice(0)) resolve(false)
	}

	onScopeDispose(() => {
		disposed = true
		invalidatePendingLoads()
	})

	return { loaded, parsed, retry, states }
}

function sourceKey(source: GhostRecordSource) {
	return `${source.ghostUrl ?? ''}:${source.mediaRevision ?? source.dateCreated}`
}

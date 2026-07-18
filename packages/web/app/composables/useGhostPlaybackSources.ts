import type {
	GhostLoadState,
	GhostRecordSource,
	LoadedPlaybackGhost,
	ParsedPlaybackGhost,
} from '~/types/ghost'
import { loadGhostBinary, parseGhostCdnOrigins } from '~/utils/ghostDownload.client'
import { buildGhostVisualIdentities, type GhostIdentityLabels } from '~/utils/ghostVisualIdentity'

export type GhostPlaybackSourceOptions = {
	sources: Ref<readonly GhostRecordSource[]>
	identityLabels: GhostIdentityLabels
	locale: Ref<string>
	primaryColor: Ref<string>
	fallbackPalette: readonly string[]
}

export function useGhostPlaybackSources(options: GhostPlaybackSourceOptions) {
	const maximumConcurrentLoads = 3
	const config = useRuntimeConfig()
	const states = reactive(new Map<number, GhostLoadState>())
	const parsed = shallowReactive(new Map<number, ParsedPlaybackGhost>())
	const requested = new Map<number, string>()
	const generations = new Map<number, number>()
	const loadWaiters: Array<() => void> = []
	let activeLoads = 0
	const allowedOrigins = parseGhostCdnOrigins(String(config.public.ghostCdnOrigins))

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
		() => options.sources.value,
		(sources) => {
			if (import.meta.server) return
			const activeIds = new Set(sources.map(({ recordId }) => recordId))
			for (const recordId of requested.keys()) {
				if (activeIds.has(recordId)) continue
				requested.delete(recordId)
				states.delete(recordId)
				parsed.delete(recordId)
				generations.set(recordId, (generations.get(recordId) ?? 0) + 1)
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
		await acquireLoadSlot()
		try {
			if (!isCurrent(source.recordId, key, generation)) return
			const { parseGhostInWorker } = await import('~/composables/useGhostParserWorker.client')
			if (!isCurrent(source.recordId, key, generation)) return
			states.set(source.recordId, {
				status: 'loading',
				progress: 'decompressing',
				source: null,
			})
			const result = await loadGhostBinary(source, allowedOrigins, {
				parse: parseGhostInWorker,
			})
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
		const source = options.sources.value.find((candidate) => candidate.recordId === recordId)
		if (!source) return
		requested.delete(recordId)
		void load(source)
	}

	function isCurrent(recordId: number, key: string, generation: number) {
		return requested.get(recordId) === key && generations.get(recordId) === generation
	}

	async function acquireLoadSlot() {
		if (activeLoads < maximumConcurrentLoads) {
			activeLoads++
			return
		}
		await new Promise<void>((resolve) => loadWaiters.push(resolve))
	}

	function releaseLoadSlot() {
		const next = loadWaiters.shift()
		if (next) next()
		else activeLoads--
	}

	return { loaded, parsed, retry, states }
}

function sourceKey(source: GhostRecordSource) {
	return `${source.ghostUrl ?? ''}:${source.mediaRevision ?? source.dateCreated}`
}

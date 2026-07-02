import { trace } from '@opentelemetry/api'
import { SurfaceState } from './enums'
import type { KnownSurface } from './types'
import { KNOWN_SURFACES } from './types'

export function normalizeSurface(surface: string): KnownSurface {
	if ((KNOWN_SURFACES as readonly string[]).includes(surface)) {
		return surface as KnownSurface
	}
	trace.getActiveSpan()?.addEvent('record.ghost.unknown_surface', {
		'record.ghost.surface': surface,
		'record.ghost.surface_mapped_to': 'tarmac',
	})
	return 'tarmac'
}

export function emptySurfaceValues(): Record<KnownSurface, number> {
	return {
		tarmac: 0,
		grass: 0,
		sand: 0,
		snow: 0,
		ice: 0,
		soap: 0,
		metal: 0,
	}
}

export function surfacesFromState(surfaceState: number): KnownSurface[] {
	const surfaces: KnownSurface[] = []
	if ((surfaceState & SurfaceState.Grass) !== 0) surfaces.push('grass')
	if ((surfaceState & SurfaceState.Sand) !== 0) surfaces.push('sand')
	if ((surfaceState & SurfaceState.Snow) !== 0) surfaces.push('snow')
	if ((surfaceState & SurfaceState.Ice) !== 0) surfaces.push('ice')
	if ((surfaceState & SurfaceState.Soap) !== 0) surfaces.push('soap')
	if ((surfaceState & SurfaceState.Metal) !== 0) surfaces.push('metal')
	if (surfaces.length === 0 || (surfaceState & SurfaceState.Tarmac) !== 0) {
		surfaces.unshift('tarmac')
	}
	return [...new Set(surfaces)]
}

export function addSurfaceValues(
	target: Record<KnownSurface, number>,
	source: unknown,
	field: string,
	toNumber: (value: unknown, field: string) => number | null,
) {
	if (source === undefined || source === null) {
		return
	}
	if (typeof source !== 'object' || Array.isArray(source)) {
		throw new Error(`Invalid ghost statistic ${field}`)
	}
	for (const [surface, value] of Object.entries(source)) {
		const number = toNumber(value, `${field}.${surface}`)
		if (number !== null) {
			target[normalizeSurface(surface)] += number
		}
	}
}

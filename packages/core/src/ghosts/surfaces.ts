import { addActiveSpanEvent } from '@zeepkist/telemetry'
import type { KnownSurface } from './surfaceState'
import { KNOWN_SURFACES } from './surfaceState'

export type { KnownSurface } from './surfaceState'
export {
	KNOWN_SURFACES,
	surfacesFromState,
	surfacesFromV6State,
	surfacesFromV7State,
} from './surfaceState'

export function normalizeSurface(surface: string): KnownSurface {
	if ((KNOWN_SURFACES as readonly string[]).includes(surface)) {
		return surface as KnownSurface
	}
	addActiveSpanEvent('record.ghost.unknown_surface', {
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
		soap: 0,
		wood: 0,
		mud: 0,
		ice1: 0,
		ice2: 0,
		ice3: 0,
	}
}

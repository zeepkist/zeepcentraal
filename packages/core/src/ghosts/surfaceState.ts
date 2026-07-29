import { SurfaceState } from './enums'

export const KNOWN_SURFACES = [
	'tarmac',
	'grass',
	'sand',
	'snow',
	'ice',
	'soap',
	'metal',
	'wood',
	'mud',
	'flesh',
] as const

export type KnownSurface = (typeof KNOWN_SURFACES)[number]

export function surfacesFromState(surfaceState: number): KnownSurface[] {
	const surfaces: KnownSurface[] = []
	if ((surfaceState & SurfaceState.Grass) !== 0) surfaces.push('grass')
	if ((surfaceState & SurfaceState.Sand) !== 0) surfaces.push('sand')
	if ((surfaceState & SurfaceState.Snow) !== 0) surfaces.push('snow')
	if ((surfaceState & SurfaceState.Ice) !== 0) surfaces.push('ice')
	if ((surfaceState & SurfaceState.Soap) !== 0) surfaces.push('soap')
	if ((surfaceState & SurfaceState.Metal) !== 0) surfaces.push('metal')
	if ((surfaceState & SurfaceState.Wood) !== 0) surfaces.push('wood')
	if ((surfaceState & SurfaceState.Mud) !== 0) surfaces.push('mud')
	if ((surfaceState & SurfaceState.Flesh) !== 0) surfaces.push('flesh')
	if (surfaces.length === 0 || (surfaceState & SurfaceState.Tarmac) !== 0) {
		surfaces.unshift('tarmac')
	}
	return [...new Set(surfaces)]
}

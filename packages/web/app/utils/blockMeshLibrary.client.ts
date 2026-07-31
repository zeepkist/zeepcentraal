import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type BlockMeshMatrix = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

export type BlockMeshPart = {
	mesh: string
	matrix: BlockMeshMatrix
	name: string
}

export type BlockMeshDefinition = {
	name: string
	parts: BlockMeshPart[]
}

export type BlockMeshManifest = {
	version: 1
	blocks: Record<string, BlockMeshDefinition>
}

export type LoadedBlockMeshPrimitive = {
	geometry: THREE.BufferGeometry
	matrix: THREE.Matrix4
}

export type LoadedBlockMeshes = {
	meshes: Map<string, LoadedBlockMeshPrimitive[]>
	failed: Set<string>
}

export type BlockMeshFallbackReport =
	| { kind: 'manifest'; error: unknown }
	| { kind: 'mesh'; mesh: string; error: unknown }

type GltfResult = Awaited<ReturnType<GLTFLoader['loadAsync']>>

export type BlockMeshLibraryOptions = {
	baseUrl: string
	concurrency?: number
	fetch?: typeof globalThis.fetch
	loader?: Pick<GLTFLoader, 'loadAsync'>
	reportFallback?: (report: BlockMeshFallbackReport) => void
}

export class BlockMeshLibrary {
	private readonly baseUrl: string
	private readonly concurrency: number
	private readonly fetchImplementation: typeof globalThis.fetch
	private readonly loader: Pick<GLTFLoader, 'loadAsync'>
	private readonly reportFallback: (report: BlockMeshFallbackReport) => void
	private readonly meshPromises = new Map<string, Promise<LoadedBlockMeshPrimitive[]>>()
	private readonly loadedScenes = new Set<THREE.Object3D>()
	private manifestPromise: Promise<BlockMeshManifest> | null = null
	private disposed = false

	constructor(options: BlockMeshLibraryOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, '')
		this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 8))
		this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis)
		this.loader = options.loader ?? new GLTFLoader()
		this.reportFallback =
			options.reportFallback ??
			((report) => console.warn('Block mesh unavailable; using box fallback.', report))
	}

	async getManifest(): Promise<BlockMeshManifest> {
		if (!this.baseUrl) throw new Error('Block mesh base URL is not configured')
		this.manifestPromise ??= this.fetchImplementation(`${this.baseUrl}/manifest.json`)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Block mesh manifest request failed: ${response.status}`)
				}
				const value = (await response.json()) as Partial<BlockMeshManifest>
				if (value.version !== 1 || !value.blocks || typeof value.blocks !== 'object') {
					throw new Error('Block mesh manifest has unsupported shape')
				}
				return value as BlockMeshManifest
			})
			.catch((error: unknown) => {
				this.reportFallback({ kind: 'manifest', error })
				throw error
			})
		return this.manifestPromise
	}

	async getDefinition(blockId: number): Promise<BlockMeshDefinition | null> {
		return (await this.getManifest()).blocks[String(blockId)] ?? null
	}

	loadMesh(mesh: string): Promise<LoadedBlockMeshPrimitive[]> {
		const cached = this.meshPromises.get(mesh)
		if (cached) return cached
		const promise = this.loader
			.loadAsync(`${this.baseUrl}/meshes/${encodeURIComponent(mesh)}.glb`)
			.then((gltf) => this.extractPrimitives(gltf))
			.catch((error: unknown) => {
				this.reportFallback({ kind: 'mesh', mesh, error })
				throw error
			})
		this.meshPromises.set(mesh, promise)
		return promise
	}

	async loadMeshes(meshes: Iterable<string>): Promise<LoadedBlockMeshes> {
		const pending = [...new Set(meshes)]
		const loaded = new Map<string, LoadedBlockMeshPrimitive[]>()
		const failed = new Set<string>()
		let nextIndex = 0
		const worker = async () => {
			while (nextIndex < pending.length) {
				const index = nextIndex
				nextIndex += 1
				const mesh = pending[index]
				if (!mesh) continue
				try {
					loaded.set(mesh, await this.loadMesh(mesh))
				} catch {
					failed.add(mesh)
				}
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(this.concurrency, pending.length) }, () => worker()),
		)
		return { meshes: loaded, failed }
	}

	dispose() {
		this.disposed = true
		for (const scene of this.loadedScenes) disposeGltfScene(scene)
		this.loadedScenes.clear()
		this.meshPromises.clear()
		this.manifestPromise = null
	}

	private extractPrimitives(gltf: GltfResult): LoadedBlockMeshPrimitive[] {
		if (this.disposed) {
			disposeGltfScene(gltf.scene)
			throw new Error('Block mesh library is disposed')
		}
		this.loadedScenes.add(gltf.scene)
		gltf.scene.updateMatrixWorld(true)
		const primitives: LoadedBlockMeshPrimitive[] = []
		gltf.scene.traverse((object) => {
			if (
				!(object instanceof THREE.Mesh) ||
				!(object.geometry instanceof THREE.BufferGeometry)
			) {
				return
			}
			primitives.push({
				geometry: object.geometry,
				matrix: object.matrixWorld.clone(),
			})
		})
		if (primitives.length === 0) throw new Error('GLB contains no mesh primitives')
		return primitives
	}
}

function disposeGltfScene(scene: THREE.Object3D) {
	const geometries = new Set<THREE.BufferGeometry>()
	const materials = new Set<THREE.Material>()
	scene.traverse((object) => {
		if (!(object instanceof THREE.Mesh)) return
		geometries.add(object.geometry)
		const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
		for (const material of objectMaterials) materials.add(material)
	})
	for (const geometry of geometries) geometry.dispose()
	for (const material of materials) material.dispose()
}

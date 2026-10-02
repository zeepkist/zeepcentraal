import * as THREE from 'three'

export function isOpaqueGhostGeometry(object: THREE.Object3D) {
	return (
		object instanceof THREE.Mesh &&
		object.userData.lightingGeometry === true &&
		!(Array.isArray(object.material) ? object.material : [object.material]).some(
			(material) => material.transparent,
		)
	)
}

/** Preserve hidden objects and transparent materials across auxiliary passes. */
export function hideGhostLightingHelpers(
	scene: THREE.Scene,
	include: (object: THREE.Object3D) => boolean = isOpaqueGhostGeometry,
) {
	const hidden: THREE.Object3D[] = []
	scene.traverse((object) => {
		if (
			object.visible &&
			(object instanceof THREE.Mesh ||
				object instanceof THREE.Line ||
				object instanceof THREE.Points ||
				object.type === 'CSS2DObject') &&
			!include(object)
		) {
			object.visible = false
			hidden.push(object)
		}
	})
	return () => {
		for (const object of hidden) object.visible = true
	}
}

/** Capture emission or environment specular independently, retaining occlusion and instancing. */
export class GhostMaterialContributionPass {
	private readonly materials = new Map<THREE.Material, THREE.Material>()
	constructor(private readonly contribution: 'emission' | 'environment') {}
	render(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		camera: THREE.Camera,
		target: THREE.WebGLRenderTarget,
	) {
		const hidden = hideGhostLightingHelpers(
			scene,
			this.contribution === 'emission'
				? (object) =>
						object instanceof THREE.Mesh && object.userData.lightingGeometry === true
				: (object) =>
						object instanceof THREE.Mesh &&
						(object.userData.reflectionSource === true ||
							object.name.startsWith('ghost-model-')),
		)
		const replaced: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = []
		const background = scene.background
		const fog = scene.fog
		const previousTarget = renderer.getRenderTarget()
		const clearColor = renderer.getClearColor(new THREE.Color()),
			alpha = renderer.getClearAlpha()
		try {
			scene.background = null
			scene.traverseVisible((object) => {
				if (!(object instanceof THREE.Mesh)) return
				replaced.push([object, object.material])
				object.material = Array.isArray(object.material)
					? object.material.map((material) => this.material(material))
					: this.material(object.material)
			})
			renderer.setRenderTarget(target)
			renderer.setClearColor(0, 0)
			renderer.clear()
			renderer.render(scene, camera)
		} finally {
			for (const [mesh, material] of replaced) mesh.material = material
			scene.background = background
			scene.fog = fog
			renderer.setClearColor(clearColor, alpha)
			renderer.setRenderTarget(previousTarget)
			hidden()
		}
	}
	private material(source: THREE.Material) {
		let material = this.materials.get(source)
		if (!material) {
			if (source instanceof THREE.MeshStandardMaterial) {
				material = source.clone()
				const compile = source.onBeforeCompile.bind(source)
				material.onBeforeCompile = (shader, renderer) => {
					compile(shader, renderer)
					shader.fragmentShader = shader.fragmentShader.replace(
						'#include <opaque_fragment>',
						`outgoingLight = ${this.contribution === 'emission' ? 'totalEmissiveRadiance' : 'reflectedLight.indirectSpecular'};\n#include <opaque_fragment>`,
					)
					shader.fragmentShader = shader.fragmentShader.replace(
						'#include <fog_fragment>',
						THREE.ShaderChunk.fog_fragment.replace(
							'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
							'gl_FragColor.rgb *= 1.0 - fogFactor;',
						),
					)
				}
				material.customProgramCacheKey = () =>
					`${source.customProgramCacheKey()}-${this.contribution}`
			} else {
				material = new THREE.MeshBasicMaterial({
					color: 0,
					side: source.side,
					transparent: source.transparent,
					opacity: source.opacity,
					fog: false,
				})
			}
			this.materials.set(source, material)
		}
		return material
	}
	dispose() {
		for (const material of this.materials.values()) material.dispose()
		this.materials.clear()
	}
}

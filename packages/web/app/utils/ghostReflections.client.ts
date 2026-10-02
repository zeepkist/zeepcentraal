import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js'
import { GhostMaterialContributionPass } from './ghostLightingPasses.client'

export type GhostReflectionQuality = 'performance' | 'balanced' | 'quality'

export function resolveGhostReflectionQuality(quality: GhostReflectionQuality) {
	return quality === 'quality'
		? { resolutionScale: 1, cubeSize: 1024, interval: 100 }
		: quality === 'balanced'
			? { resolutionScale: 0.5, cubeSize: 512, interval: 200 }
			: { resolutionScale: 0, cubeSize: 128, interval: 500 }
}

export class GhostReflectionClock {
	private dirty = true
	private forced = true
	private capturedAt = -Infinity
	mark(force = false) {
		this.dirty = true
		this.forced ||= force
	}
	due(timestamp: number, interval: number) {
		return this.dirty && (this.forced || timestamp - this.capturedAt >= interval)
	}
	commit(timestamp: number) {
		this.capturedAt = timestamp
		this.dirty = false
		this.forced = false
	}
}

export function isGhostReflectionSource(object: THREE.Object3D) {
	return (
		object instanceof THREE.Mesh &&
		(object.userData.reflectionSource === true || object.name.startsWith('ghost-model-'))
	)
}

function hideReflectionHelpers(scene: THREE.Scene, opaqueOnly = false) {
	const hidden: THREE.Object3D[] = []
	scene.traverse((object) => {
		if (!object.visible) return
		if (
			object instanceof THREE.Mesh ||
			object instanceof THREE.Line ||
			object instanceof THREE.Points ||
			object.type === 'CSS2DObject'
		) {
			const glass =
				object instanceof THREE.Mesh &&
				(Array.isArray(object.material)
					? object.material.some(
							(material) => material.transparent && material.userData.reflection,
						)
					: object.material.transparent && object.material.userData.reflection)
			if (!isGhostReflectionSource(object) || (opaqueOnly && glass)) {
				object.visible = false
				hidden.push(object)
			}
		}
	})
	return () => {
		for (const object of hidden) object.visible = true
	}
}

// RGB carries linear F0; alpha carries roughness. Stock SSR's binary metalness
// mask cannot represent authored dielectric/specular materials.
class MaterialSSRPass extends SSRPass {
	private readonly masks = new Map<THREE.Material, THREE.ShaderMaterial>()
	constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
		super({ renderer, scene, camera, selects: [], groundReflector: null, width: 1, height: 1 })
		this.output = SSRPass.OUTPUT.SSR
		for (const target of [
			this.beautyRenderTarget,
			this.ssrRenderTarget,
			this.blurRenderTarget,
			this.blurRenderTarget2,
		])
			target.texture.type = THREE.HalfFloatType
		this.opacity = 0.85
		this.maxDistance = 160
		this.thickness = 0.15
		this.fresnel = false
		this.ssrMaterial.fragmentShader = this.ssrMaterial.fragmentShader
			.replace('void main(){', 'void main(){ gl_FragColor=vec4(0.);')
			.replace(
				'float metalness=texture2D(tMetalness,vUv).r;',
				'vec4 finish=texture2D(tMetalness,vUv); float metalness=max(max(finish.r,finish.g),finish.b);',
			)
			.replace('if(metalness==0.) return;', 'if(metalness==0. || finish.a>0.65) return;')
			.replace(
				'gl_FragColor.xyz=reflectColor.xyz;',
				'float grazing=pow(1.-clamp(dot(-viewIncidentDir,viewNormal),0.,1.),5.); vec3 tint=mix(finish.rgb,vec3(1.),grazing); gl_FragColor.xyz=reflectColor.xyz*tint;',
			)
			.replace('gl_FragColor.a=op;', 'gl_FragColor.a=op*(1.-finish.a)*(1.-finish.a);')
		for (const material of [this.blurMaterial, this.blurMaterial2]) {
			material.uniforms.tFinish = { value: this.metalnessRenderTarget.texture }
			material.fragmentShader = material.fragmentShader
				.replace(
					'uniform sampler2D tDiffuse;',
					'uniform sampler2D tDiffuse; uniform sampler2D tFinish;',
				)
				.replace(
					'vec2 texelSize = ( 1.0 / resolution );',
					'vec2 texelSize = (1.0 / resolution) * (1.0 + 12.0 * texture2D(tFinish,vUv).a);',
				)
				.replace('/a;', '/max(a,0.00001);')
		}
	}

	// Called by SSRPass. Glass never replaces underlying opaque reflection depth or normals.
	_renderOverride(
		renderer: THREE.WebGLRenderer,
		material: THREE.Material,
		target: THREE.WebGLRenderTarget,
	) {
		const restore = hideReflectionHelpers(this.scene, true)
		const previous = this.scene.overrideMaterial
		try {
			renderer.setRenderTarget(target)
			renderer.clear()
			this.scene.overrideMaterial = material
			renderer.render(this.scene, this.camera)
		} finally {
			this.scene.overrideMaterial = previous
			restore()
		}
	}

	_renderMetalness(
		renderer: THREE.WebGLRenderer,
		_material: THREE.Material,
		target: THREE.WebGLRenderTarget,
	) {
		const restore = hideReflectionHelpers(this.scene, true)
		const replaced: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> =
			[]
		const background = this.scene.background
		const clearColor = renderer.getClearColor(new THREE.Color())
		const clearAlpha = renderer.getClearAlpha()
		try {
			this.scene.background = null
			this.scene.traverseVisible((object) => {
				if (!(object instanceof THREE.Mesh)) return
				replaced.push({ mesh: object, material: object.material })
				object.material = Array.isArray(object.material)
					? object.material.map((material) => this.mask(material))
					: this.mask(object.material)
			})
			renderer.setRenderTarget(target)
			renderer.setClearColor(0, 0)
			renderer.clear()
			renderer.render(this.scene, this.camera)
		} finally {
			for (const entry of replaced) entry.mesh.material = entry.material
			this.scene.background = background
			renderer.setClearColor(clearColor, clearAlpha)
			restore()
		}
	}

	private mask(material: THREE.Material) {
		let mask = this.masks.get(material)
		if (!mask) {
			const finish = material.userData.reflection as
				| { color: THREE.Color; roughness: number }
				| undefined
			mask = new THREE.ShaderMaterial({
				uniforms: {
					finish: {
						value: new THREE.Vector4(
							finish?.color.r ?? 0,
							finish?.color.g ?? 0,
							finish?.color.b ?? 0,
							finish?.roughness ?? 1,
						),
					},
				},
				vertexShader: `void main(){vec4 p=vec4(position,1.);
				#ifdef USE_INSTANCING
				p=instanceMatrix*p;
				#endif
				gl_Position=projectionMatrix*modelViewMatrix*p;}`,
				fragmentShader: 'uniform vec4 finish; void main(){gl_FragColor=finish;}',
				side: material.side,
			})
			this.masks.set(material, mask)
		}
		return mask
	}

	updateCamera(camera: THREE.Camera) {
		this.camera = camera
		const depthCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera
		const perspective = camera instanceof THREE.PerspectiveCamera
		if (this.ssrMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
			this.ssrMaterial.defines.PERSPECTIVE_CAMERA = perspective
			this.ssrMaterial.needsUpdate = true
		}
		for (const material of [this.ssrMaterial, this.depthRenderMaterial]) {
			if (material.uniforms.cameraNear) material.uniforms.cameraNear.value = depthCamera.near
			if (material.uniforms.cameraFar) material.uniforms.cameraFar.value = depthCamera.far
		}
		const projection = this.ssrMaterial.uniforms.cameraProjectionMatrix
		const inverse = this.ssrMaterial.uniforms.cameraInverseProjectionMatrix
		if (!projection || !inverse) throw new Error('SSR projection uniforms missing')
		projection.value.copy(camera.projectionMatrix)
		inverse.value.copy(camera.projectionMatrixInverse)
	}

	override dispose() {
		super.dispose()
		// Upstream dispose omits ssrMaterial.
		this.ssrMaterial.dispose()
		for (const mask of this.masks.values()) mask.dispose()
		this.masks.clear()
	}
}

export class GhostReflectionRenderer {
	private readonly settings
	private readonly clock = new GhostReflectionClock()
	private readonly cube: THREE.WebGLCubeRenderTarget
	private readonly cubeCamera: THREE.CubeCamera
	private readonly pmrem: THREE.PMREMGenerator
	private environment: THREE.WebGLRenderTarget | null = null
	private readonly previousEnvironment: THREE.Texture | null
	private readonly captureBackground: THREE.Scene['background']
	private pass: MaterialSSRPass | null = null
	private readonly beauty = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
	private readonly reflection = new THREE.WebGLRenderTarget(1, 1, {
		type: THREE.HalfFloatType,
		depthBuffer: false,
	})
	private readonly environmentSpecular = new THREE.WebGLRenderTarget(1, 1, {
		type: THREE.HalfFloatType,
	})
	private readonly specularPass = new GhostMaterialContributionPass('environment')
	private readonly composite: THREE.ShaderMaterial
	private readonly quad: FullScreenQuad
	private readonly size = new THREE.Vector2()
	private disposed = false

	constructor(
		private readonly renderer: THREE.WebGLRenderer,
		private readonly scene: THREE.Scene,
		quality: GhostReflectionQuality,
	) {
		this.settings = resolveGhostReflectionQuality(quality)
		this.cube = new THREE.WebGLCubeRenderTarget(this.settings.cubeSize, {
			type: THREE.HalfFloatType,
		})
		this.cubeCamera = new THREE.CubeCamera(0.1, 5_000, this.cube)
		this.pmrem = new THREE.PMREMGenerator(renderer)
		this.previousEnvironment = scene.environment
		this.captureBackground = scene.background
		this.composite = new THREE.ShaderMaterial({
			uniforms: {
				beauty: { value: this.beauty.texture },
				reflection: { value: this.reflection.texture },
				environmentSpecular: { value: this.environmentSpecular.texture },
			},
			vertexShader:
				'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
			fragmentShader: `uniform sampler2D beauty; uniform sampler2D reflection; uniform sampler2D environmentSpecular; varying vec2 vUv;
			void main(){vec4 base=texture2D(beauty,vUv);vec4 reflected=texture2D(reflection,vUv);
			vec3 environment=texture2D(environmentSpecular,vUv).rgb;
			gl_FragColor=vec4(max(vec3(0.),base.rgb-environment*reflected.a)+reflected.rgb*reflected.a,base.a);
			}`,
			depthTest: false,
			depthWrite: false,
			toneMapped: false,
		})
		this.quad = new FullScreenQuad(this.composite)
	}

	markDirty(force = false) {
		this.clock.mark(force)
	}

	render(camera: THREE.Camera, target: THREE.Vector3, timestamp: number) {
		if (this.disposed) return
		const previousTarget = this.renderer.getRenderTarget()
		try {
			if (this.clock.due(timestamp, this.settings.interval)) {
				const restore = hideReflectionHelpers(this.scene)
				const previousEnvironment = this.scene.environment
				const previousBackground = this.scene.background
				try {
					// Capture authored ambient only. Never feed the previous capture into itself.
					this.scene.environment = this.previousEnvironment
					this.scene.background = this.captureBackground
					this.cubeCamera.position.copy(target).add(new THREE.Vector3(0, 2, 0))
					this.cubeCamera.update(this.renderer, this.scene)
					this.environment = this.pmrem.fromCubemap(
						this.cube.texture,
						this.environment ?? undefined,
					)
					this.scene.environment = this.environment.texture
					this.clock.commit(timestamp)
				} finally {
					this.scene.environment = this.environment?.texture ?? previousEnvironment
					this.scene.background = previousBackground
					restore()
				}
			}
			if (!this.settings.resolutionScale) {
				this.renderer.setRenderTarget(previousTarget)
				this.renderer.render(this.scene, camera)
				return
			}
			if (!this.pass) {
				this.pass = new MaterialSSRPass(this.renderer, this.scene, camera)
				this.pass.resolutionScale = this.settings.resolutionScale
			}
			const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
			if (!size.equals(this.size)) {
				this.size.copy(size)
				this.beauty.setSize(size.x, size.y)
				this.reflection.setSize(size.x, size.y)
				this.environmentSpecular.setSize(size.x, size.y)
				this.pass.setSize(size.x, size.y)
			}
			this.pass.updateCamera(camera)
			const restore = hideReflectionHelpers(this.scene)
			const depthMaterials = new Map<THREE.Material, boolean>()
			this.scene.traverseVisible((object) => {
				if (!(object instanceof THREE.Mesh) || !object.name.startsWith('ghost-model-'))
					return
				for (const material of Array.isArray(object.material)
					? object.material
					: [object.material]) {
					if (!depthMaterials.has(material))
						depthMaterials.set(material, material.depthWrite)
					material.depthWrite = true
				}
			})
			try {
				this.pass.render(this.renderer, this.reflection, this.beauty, 0, false)
			} finally {
				for (const [material, depthWrite] of depthMaterials)
					material.depthWrite = depthWrite
				restore()
			}
			this.renderer.setRenderTarget(this.beauty)
			this.renderer.render(this.scene, camera)
			this.specularPass.render(this.renderer, this.scene, camera, this.environmentSpecular)
			this.renderer.setRenderTarget(previousTarget)
			this.quad.render(this.renderer)
		} finally {
			this.renderer.setRenderTarget(previousTarget)
		}
	}

	dispose() {
		if (this.disposed) return
		this.disposed = true
		if (this.scene.environment === this.environment?.texture)
			this.scene.environment = this.previousEnvironment
		this.environment?.dispose()
		this.cube.dispose()
		this.pmrem.dispose()
		this.pass?.dispose()
		this.beauty.dispose()
		this.reflection.dispose()
		this.environmentSpecular.dispose()
		this.specularPass.dispose()
		this.composite.dispose()
		this.quad.dispose()
	}
}

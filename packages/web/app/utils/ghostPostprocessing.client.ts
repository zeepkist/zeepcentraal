import * as THREE from 'three'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
	type GhostLightingQuality,
	type GhostLightingRig,
	resolveGhostLightingQuality,
} from './ghostLighting.client'
import {
	GhostMaterialContributionPass,
	hideGhostLightingHelpers,
} from './ghostLightingPasses.client'
import { GhostReflectionRenderer } from './ghostReflections.client'
import { GhostVolumetricPass } from './ghostVolumetrics.client'

const hdrTarget = (depthBuffer = true) =>
	new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer })

/** All material passes stay linear HDR. OutputPass alone maps to display space. */
export class GhostPostprocessing {
	private readonly settings
	private readonly beauty = hdrTarget()
	private readonly combined = hdrTarget(false)
	private readonly emission = hdrTarget()
	private readonly bloomInput = hdrTarget(false)
	private readonly beams = hdrTarget(false)
	private readonly depth = hdrTarget()
	private readonly depthTexture = new THREE.DepthTexture(1, 1)
	private readonly depthMaterial = new THREE.MeshDepthMaterial()
	private readonly emissionPass = new GhostMaterialContributionPass('emission')
	private readonly output = new OutputPass()
	private readonly reflection: GhostReflectionRenderer
	private ao: GTAOPass | null = null
	private readonly bloom: UnrealBloomPass | null
	private readonly volume: GhostVolumetricPass | null
	private readonly size = new THREE.Vector2()
	private readonly composite: THREE.ShaderMaterial
	private readonly uniforms = {
		beauty: { value: this.beauty.texture },
		ao: { value: null as THREE.Texture | null },
		glow: { value: null as THREE.Texture | null },
		beams: { value: null as THREE.Texture | null },
		effects: { value: false },
	}
	private readonly quad: FullScreenQuad
	private disposed = false
	constructor(
		private readonly renderer: THREE.WebGLRenderer,
		private readonly scene: THREE.Scene,
		quality: GhostLightingQuality,
	) {
		this.settings = resolveGhostLightingQuality(quality)
		this.depth.depthTexture = this.depthTexture
		this.reflection = new GhostReflectionRenderer(renderer, scene, quality)
		this.bloom = this.settings.effectScale
			? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.35, 0.5)
			: null
		this.volume = this.settings.beamSteps
			? new GhostVolumetricPass(this.settings.beamSteps)
			: null
		this.output.renderToScreen = true
		this.uniforms.effects.value = Boolean(this.bloom)
		this.composite = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader:
				'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
			fragmentShader: `varying vec2 vUv;uniform sampler2D beauty,ao,glow,beams;uniform bool effects;
			void main(){vec4 color=texture2D(beauty,vUv);if(effects){float contact=mix(1.,texture2D(ao,vUv).r,.65);color.rgb=color.rgb*contact+texture2D(glow,vUv).rgb+texture2D(beams,vUv).rgb;}gl_FragColor=color;}`,
			depthTest: false,
			depthWrite: false,
			toneMapped: false,
		})
		this.quad = new FullScreenQuad(this.composite)
	}
	markDirty(force = false) {
		this.reflection.markDirty(force)
	}
	render(camera: THREE.Camera, target: THREE.Vector3, timestamp: number, rig: GhostLightingRig) {
		if (this.disposed) return
		const previous = this.renderer.getRenderTarget()
		try {
			this.resize(camera)
			this.renderer.setRenderTarget(this.beauty)
			this.reflection.render(camera, target, timestamp)
			if (this.ao && this.bloom && this.volume) {
				const restore = hideGhostLightingHelpers(this.scene)
				const override = this.scene.overrideMaterial,
					background = this.scene.background
				try {
					this.scene.background = null
					this.scene.overrideMaterial = this.depthMaterial
					this.renderer.setRenderTarget(this.depth)
					this.renderer.clear()
					this.renderer.render(this.scene, camera)
					this.scene.overrideMaterial = override
					this.ao.camera = camera as THREE.PerspectiveCamera
					const perspective = camera instanceof THREE.PerspectiveCamera ? 1 : 0
					for (const material of [this.ao.gtaoMaterial, this.ao.pdMaterial]) {
						if (material.defines.PERSPECTIVE_CAMERA !== perspective) {
							material.defines.PERSPECTIVE_CAMERA = perspective
							material.needsUpdate = true
						}
					}
					this.ao.render(this.renderer, this.combined, this.beauty, 0, false)
				} finally {
					this.scene.overrideMaterial = override
					this.scene.background = background
					restore()
				}
				this.emissionPass.render(this.renderer, this.scene, camera, this.emission)
				this.bloom.render(this.renderer, this.bloomInput, this.emission, 0, false)
				this.volume.render(this.renderer, camera, this.depthTexture, rig, this.beams)
				this.uniforms.ao.value = this.ao.pdRenderTarget.texture
				this.uniforms.glow.value = this.bloom.renderTargetsHorizontal[0]?.texture ?? null
				this.uniforms.beams.value = this.beams.texture
			}
			this.renderer.setRenderTarget(this.combined)
			this.quad.render(this.renderer)
			this.output.render(this.renderer, this.combined, this.combined, 0, false)
		} finally {
			this.renderer.setRenderTarget(previous)
		}
	}
	private resize(camera: THREE.Camera) {
		const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
		if (!this.ao && this.settings.aoScale) {
			this.ao = new GTAOPass(this.scene, camera as THREE.PerspectiveCamera)
			this.ao.output = GTAOPass.OUTPUT.Off
			this.ao.updateGtaoMaterial({
				radius: 2,
				distanceExponent: 2,
				thickness: 0.4,
				samples: 16,
			})
		}
		if (size.equals(this.size)) return
		this.size.copy(size)
		for (const buffer of [this.beauty, this.combined, this.depth])
			buffer.setSize(size.x, size.y)
		const width = Math.max(1, Math.ceil(size.x * this.settings.effectScale)),
			height = Math.max(1, Math.ceil(size.y * this.settings.effectScale))
		for (const buffer of [this.emission, this.bloomInput, this.beams])
			buffer.setSize(width, height)
		this.bloom?.setSize(width * 2, height * 2)
		this.ao?.setSize(
			Math.max(1, Math.ceil(size.x * this.settings.aoScale)),
			Math.max(1, Math.ceil(size.y * this.settings.aoScale)),
		)
	}
	dispose() {
		if (this.disposed) return
		this.disposed = true
		this.reflection.dispose()
		this.ao?.dispose()
		this.bloom?.dispose()
		this.volume?.dispose()
		for (const target of [
			this.beauty,
			this.combined,
			this.emission,
			this.bloomInput,
			this.beams,
			this.depth,
		])
			target.dispose()
		this.depthMaterial.dispose()
		this.emissionPass.dispose()
		this.composite.dispose()
		this.quad.dispose()
		this.output.dispose()
	}
}

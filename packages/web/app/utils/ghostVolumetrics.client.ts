import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import type { GhostLightingRig } from './ghostLighting.client'

const fragment = `
layout(location = 0) out highp vec4 beamColor;
#define gl_FragColor beamColor
uniform sampler2D sceneDepth;
uniform mat4 inverseProjection, cameraWorld, shadowMatrix;
uniform vec3 cameraPositionWorld, lightPosition, lightDirection, lightColor;
uniform float lightRange, lightIntensity, coneCos, penumbraCos, density, anisotropy, extinction, extinctionEffect, ambientScatter, shadowNear, shadowFar, shadowBias;
uniform bool perspective, spotlight;
#ifdef SPOT_SHADOW
uniform highp sampler2DShadow spotShadow;
#endif
#ifdef POINT_SHADOW
uniform highp samplerCubeShadow pointShadow;
#endif
varying vec2 vUv;
vec3 worldPosition(float depth){vec4 p=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);return (cameraWorld*vec4(p.xyz/p.w,1.)).xyz;}
float visibility(vec3 p){
#ifdef SPOT_SHADOW
 vec4 projected=shadowMatrix*vec4(p,1.);vec3 uv=projected.xyz/projected.w;
 if(any(lessThan(uv,vec3(0.)))||any(greaterThan(uv,vec3(1.))))return 1.;
 return texture(spotShadow,vec3(uv.xy,uv.z+shadowBias));
#endif
#ifdef POINT_SHADOW
 vec3 direction=p-lightPosition;float z=max(max(abs(direction.x),abs(direction.y)),abs(direction.z));
 if(z<shadowNear||z>shadowFar)return 1.;
 float depth=shadowFar*(z-shadowNear)/(z*(shadowFar-shadowNear));
 return texture(pointShadow,vec4(normalize(direction),depth+shadowBias));
#endif
 return 1.;
}
void main(){
 vec3 start=perspective?cameraPositionWorld:worldPosition(0.);
 vec3 end=worldPosition(texture2D(sceneDepth,vUv).r);vec3 ray=normalize(end-start);
 float distanceLimit=length(end-start);vec3 offset=start-lightPosition;
 float b=dot(offset,ray),c=dot(offset,offset)-lightRange*lightRange,disc=b*b-c;
 if(disc<=0.){gl_FragColor=vec4(0.);return;}
 float enter=max(0.,-b-sqrt(disc)),leave=min(distanceLimit,-b+sqrt(disc));
 if(leave<=enter){gl_FragColor=vec4(0.);return;}
 float stepLength=(leave-enter)/float(STEPS),scatter=0.;
 // Fixed midpoint samples keep idle frames and fixture captures deterministic.
 for(int i=0;i<STEPS;i++){
  float t=enter+(float(i)+.5)*stepLength;vec3 p=start+ray*t;
  vec3 fromLight=p-lightPosition;float d=length(fromLight),relative=d/lightRange;
  float cone=spotlight?smoothstep(coneCos,max(coneCos+.0001,penumbraCos),dot(normalize(fromLight),lightDirection)):1.;
  float attenuation=pow(max(0.,1.-pow(relative,4.)),2.)/(1.+25.*relative*relative);
  float cosine=dot(normalize(fromLight),-ray);
  float phase=(1.-anisotropy*anisotropy)/(12.56637*pow(max(.001,1.+anisotropy*anisotropy-2.*anisotropy*cosine),1.5))+ambientScatter/12.56637;
  float transmission=exp(-extinction*density*(d+t));
  scatter+=cone*attenuation*phase*visibility(p)*density*stepLength*mix(1.,transmission,extinctionEffect);
 }
 gl_FragColor=vec4(lightColor*lightIntensity*scatter,0.);
}`

const createUniforms = () => ({
	sceneDepth: { value: null as THREE.Texture | null },
	inverseProjection: { value: new THREE.Matrix4() },
	cameraWorld: { value: new THREE.Matrix4() },
	cameraPositionWorld: { value: new THREE.Vector3() },
	perspective: { value: true },
	spotlight: { value: false },
	lightPosition: { value: new THREE.Vector3() },
	lightDirection: { value: new THREE.Vector3() },
	lightColor: { value: new THREE.Color() },
	lightRange: { value: 1 },
	lightIntensity: { value: 1 },
	coneCos: { value: 0 },
	penumbraCos: { value: 1 },
	density: { value: 0 },
	anisotropy: { value: 0 },
	extinction: { value: 0.05 },
	extinctionEffect: { value: 0 },
	ambientScatter: { value: 0 },
	shadowMatrix: { value: new THREE.Matrix4() },
	spotShadow: { value: null as THREE.Texture | null },
	pointShadow: { value: null as THREE.Texture | null },
	shadowNear: { value: 0.1 },
	shadowFar: { value: 100 },
	shadowBias: { value: 0 },
})

type BeamMaterial = { material: THREE.ShaderMaterial; uniforms: ReturnType<typeof createUniforms> }

export class GhostVolumetricPass {
	private readonly materials = new Map<string, BeamMaterial>()
	private readonly quad = new FullScreenQuad()
	constructor(private readonly steps: number) {}
	render(
		renderer: THREE.WebGLRenderer,
		camera: THREE.Camera,
		depth: THREE.Texture,
		rig: GhostLightingRig,
		target: THREE.WebGLRenderTarget,
	) {
		const previous = renderer.getRenderTarget(),
			autoClear = renderer.autoClear
		const clear = renderer.getClearColor(new THREE.Color()),
			alpha = renderer.getClearAlpha()
		try {
			renderer.setRenderTarget(target)
			renderer.setClearColor(0, 0)
			renderer.clear()
			renderer.autoClear = false
			for (const light of rig.volumetricLights) {
				const object = rig.getLightObject(light.id)
				const shadow = object?.castShadow ? object.shadow.map?.depthTexture : null
				const key = shadow ? light.type : 'none'
				const { material, uniforms } = this.material(key)
				uniforms.sceneDepth.value = depth
				uniforms.inverseProjection.value = camera.projectionMatrixInverse
				uniforms.cameraWorld.value = camera.matrixWorld
				uniforms.cameraPositionWorld.value.setFromMatrixPosition(camera.matrixWorld)
				uniforms.perspective.value = camera instanceof THREE.PerspectiveCamera
				uniforms.spotlight.value = light.type === 'spot'
				uniforms.lightPosition.value.fromArray(light.position)
				uniforms.lightDirection.value.fromArray(light.direction)
				const volumeColor = rig.environmentSettings.volumetrics
				uniforms.lightColor.value.setRGB(
					...(volumeColor.useCustomColor && volumeColor.color
						? volumeColor.color
						: light.color),
					THREE.SRGBColorSpace,
				)
				uniforms.lightRange.value = light.range
				uniforms.lightIntensity.value = object?.intensity ?? light.intensity * Math.PI
				uniforms.coneCos.value = Math.cos(light.angle)
				uniforms.penumbraCos.value = Math.cos(light.angle * (1 - light.penumbra))
				uniforms.density.value =
					rig.environmentSettings.volumetrics.density +
					(rig.environmentSettings.fog.enabled ? rig.environmentSettings.fog.density : 0)
				uniforms.anisotropy.value = rig.environmentSettings.volumetrics.anisotropy
				uniforms.extinction.value = volumeColor.extinction ?? 0.05
				uniforms.extinctionEffect.value = volumeColor.extinctionEffect ?? 0
				const ambient = new THREE.Color().setRGB(
					...rig.environmentSettings.ambient.mid,
					THREE.SRGBColorSpace,
				)
				uniforms.ambientScatter.value =
					(volumeColor.ambientStrength ?? 0.5) *
					(ambient.r * 0.2126 + ambient.g * 0.7152 + ambient.b * 0.0722)
				if (shadow && object) {
					uniforms.shadowMatrix.value = object.shadow.matrix
					uniforms.shadowNear.value = object.shadow.camera.near
					uniforms.shadowFar.value = object.shadow.camera.far
					uniforms.shadowBias.value = object.shadow.bias
					uniforms[light.type === 'spot' ? 'spotShadow' : 'pointShadow'].value = shadow
				}
				this.quad.material = material
				this.quad.render(renderer)
			}
		} finally {
			renderer.autoClear = autoClear
			renderer.setClearColor(clear, alpha)
			renderer.setRenderTarget(previous)
		}
	}
	private material(key: string) {
		let entry = this.materials.get(key)
		if (!entry) {
			const uniforms = createUniforms()
			const material = new THREE.ShaderMaterial({
				glslVersion: THREE.GLSL3,
				defines: {
					STEPS: this.steps,
					...(key === 'none'
						? {}
						: { [key === 'spot' ? 'SPOT_SHADOW' : 'POINT_SHADOW']: 1 }),
				},
				uniforms,
				vertexShader:
					'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
				fragmentShader: fragment,
				depthTest: false,
				depthWrite: false,
				transparent: true,
				blending: THREE.CustomBlending,
				blendSrc: THREE.OneFactor,
				blendDst: THREE.OneFactor,
				blendSrcAlpha: THREE.ZeroFactor,
				blendDstAlpha: THREE.OneFactor,
				toneMapped: false,
			})
			entry = { material, uniforms }
			this.materials.set(key, entry)
		}
		return entry
	}
	dispose() {
		for (const { material } of this.materials.values()) material.dispose()
		this.materials.clear()
		this.quad.dispose()
	}
}

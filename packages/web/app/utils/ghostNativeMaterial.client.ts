import * as THREE from 'three'
import {
	type ProtectedMeshMaterial,
	validateProtectedMeshMaterial,
} from '../../shared/protectedMeshFormat'

export function createGhostNativeMaterial(descriptor: ProtectedMeshMaterial) {
	validateProtectedMeshMaterial(descriptor)
	const material = new THREE.MeshPhysicalMaterial({
		color: new THREE.Color().setRGB(...descriptor.color, THREE.SRGBColorSpace),
		opacity: descriptor.opacity,
		transparent: descriptor.transparent,
		depthWrite: !descriptor.transparent,
		roughness: descriptor.roughness,
		metalness: descriptor.metalness,
		side: descriptor.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
		envMapIntensity: 1,
	})
	const specular = new THREE.Color().setRGB(...descriptor.specular, THREE.SRGBColorSpace)
	if (descriptor.workflow === 'specular') {
		// Unity specular workflow supplies F0 directly. Three's specularColor otherwise
		// multiplies dielectric F0, losing strong coloured reflections such as blue ice.
		material.onBeforeCompile = (shader) => {
			shader.uniforms.unitySpecular = { value: specular }
			shader.fragmentShader = `uniform vec3 unitySpecular;\n${shader.fragmentShader}`.replace(
				'#include <lights_physical_fragment>',
				`#include <lights_physical_fragment>
				material.specularColor = unitySpecular;
				material.diffuseColor = diffuseColor.rgb * (1.0 - max(max(unitySpecular.r, unitySpecular.g), unitySpecular.b));`,
			)
		}
		material.customProgramCacheKey = () => 'zeep-unity-specular-v1'
	}
	material.userData.reflection = {
		roughness: descriptor.roughness,
		color:
			descriptor.workflow === 'specular'
				? specular
				: new THREE.Color(0.04, 0.04, 0.04).lerp(material.color, descriptor.metalness),
	}
	return material
}

export function sortTransparentGhostInstances(
	mesh: THREE.InstancedMesh,
	matrices: THREE.Matrix4[],
	camera: THREE.Camera,
) {
	if (matrices.length < 2) return
	if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
	const center = mesh.geometry.boundingSphere?.center ?? new THREE.Vector3()
	const view = camera.matrixWorldInverse.clone().multiply(mesh.matrixWorld)
	const entries = matrices.map((matrix) => ({
		matrix,
		depth: center.clone().applyMatrix4(matrix).applyMatrix4(view).z,
	}))
	entries.sort((a, b) => a.depth - b.depth)
	for (const [index, entry] of entries.entries()) mesh.setMatrixAt(index, entry.matrix)
	mesh.instanceMatrix.needsUpdate = true
}

import type { CompilerOptions } from 'vue/compiler-sfc'

/** MDC's slot transform requires the VDOM compiler context, including nodeTransforms. */
export function guardMdcVdomTransform(options: CompilerOptions) {
	options.nodeTransforms = options.nodeTransforms?.map((transform) => {
		if (transform.name !== 'viteMDCSlot') return transform
		return function viteMDCSlot(node, context) {
			if (!Array.isArray(context.nodeTransforms)) return
			return transform(node, context)
		}
	})
}

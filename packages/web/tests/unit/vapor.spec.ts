import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { CompilerOptions } from 'vue/compiler-sfc'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import { NUXT_RUNTIME_INLINE } from '../../config/nuxtRuntime'
import { guardMdcVdomTransform } from '../../config/vapor'

describe('Vapor compiler integration', () => {
	it('binds template helpers explicitly in every application Vapor component', () => {
		const app = fileURLToPath(new URL('../../app', import.meta.url))
		const missing: string[] = []
		for (const file of readdirSync(app, { recursive: true })) {
			if (!file.endsWith('.vue')) continue
			const source = readFileSync(join(app, file), 'utf8')
			if (!source.includes('<script setup vapor')) continue
			const { descriptor } = parse(source, { filename: file })
			if (!descriptor.scriptSetup?.content.trim()) continue
			const compiled = compileScript(descriptor, { id: file, inlineTemplate: true })
			// Vapor resolves unbound template identifiers as props. Auto-imported helpers need bindings.
			for (const match of compiled.content.matchAll(/__props\.([\w$]+)/g)) {
				const name = match[1]
				if (name && !compiled.bindings?.[name]) missing.push(`${file}: ${name}`)
			}
		}
		expect([...new Set(missing)]).toEqual([])
	})
	it('inlines Nuxt renderer files with Windows and POSIX paths', () => {
		for (const path of [
			'X:\\repo\\node_modules\\nuxt\\dist\\runtime\\server\\renderer\\index.js',
			'/repo/node_modules/.bun/nuxt@4.6.0/node_modules/nuxt/dist/runtime/server/renderer/index.js',
		])
			expect(NUXT_RUNTIME_INLINE.test(path)).toBe(true)
		expect(
			NUXT_RUNTIME_INLINE.test(
				'/repo/node_modules/nuxt-og-image/dist/runtime/server/index.js',
			),
		).toBe(false)
	})
	it('keeps MDC transforms on VDOM while compiling Vapor components', () => {
		let calls = 0
		const options: CompilerOptions = {
			nodeTransforms: [
				function viteMDCSlot(_node, context) {
					expect(Array.isArray(context.nodeTransforms)).toBe(true)
					calls++
				},
			],
		}
		guardMdcVdomTransform(options)
		const { descriptor } = parse(`<script setup vapor lang="ts">
const { t } = useAppI18n()
const count = ref(0)
</script><template><button @click="count++">{{ t('count') }} {{ count }}</button></template>`)
		const vapor = compileScript(descriptor, {
			id: 'vapor-fixture',
			inlineTemplate: true,
			templateOptions: { compilerOptions: options },
		})
		expect(vapor.content).toContain('defineVaporComponent')
		expect(vapor.content).not.toContain('__props.t')
		expect(calls).toBe(0)
		const vdom = compileTemplate({
			id: 'vdom-fixture',
			filename: 'fixture.vue',
			source: '<div><slot /></div>',
			compilerOptions: options,
		})
		expect(vdom.errors).toEqual([])
		expect(calls).toBeGreaterThan(0)
	})
})

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { version } from 'vue'
import { version as compilerVersion, compileScript, parse } from 'vue/compiler-sfc'
import { NUXT_RUNTIME_INLINE } from '../../config/nuxtRuntime'

describe('stable SSR runtime', () => {
	it('uses matching stable runtime and compiler versions', () => {
		expect(version).toBe('3.5.43')
		expect(compilerVersion).toBe(version)
		const { descriptor } = parse(`<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script><template><button @click="count++">{{ count }}</button></template>`)
		const compiled = compileScript(descriptor, { id: 'ssr-fixture', inlineTemplate: true })
		expect(compiled.content).toContain('count.value++')
		expect(compiled.content).not.toContain('defineVaporComponent')
	})

	it('keeps application and test-layer components on the stable compiler', () => {
		for (const directory of ['../../app', '../motion-layer/app']) {
			const root = fileURLToPath(new URL(directory, import.meta.url))
			for (const file of readdirSync(root, { recursive: true })) {
				if (!file.endsWith('.vue')) continue
				const { descriptor, errors } = parse(readFileSync(join(root, file), 'utf8'))
				expect(errors, file).toEqual([])
				expect(descriptor.scriptSetup?.attrs.vapor, file).toBeUndefined()
			}
		}
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
})

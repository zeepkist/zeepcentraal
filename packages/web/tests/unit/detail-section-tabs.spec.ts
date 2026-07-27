import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(
	new URL('../../app/components/common/DetailSectionTabs.vue', import.meta.url),
	'utf8',
)
const model = readFileSync(new URL('../../app/types/detailTabs.ts', import.meta.url), 'utf8')

describe('detail section tabs', () => {
	it('delegates keyboard and ARIA tab behavior to controlled NuxtUI tabs', () => {
		expect(component).toContain('<UTabs')
		expect(component).toContain('v-model="activeTab"')
		expect(component).toContain(':aria-label="label"')
		expect(component).toContain("emit('update:modelValue', value)")
		expect(component).not.toMatch(/ref\(/)
	})

	it('mounts panels on first visit and retains their state after tab changes', () => {
		expect(component).toContain(':unmount-on-hide="false"')
		expect(component).toContain('reactive(new Set<T>([props.modelValue]))')
		expect(component).toContain('visitedTabs.add(value)')
		expect(component).toContain('v-if="visitedTabs.has(item.value)"')
		expect(component).toContain('v-for="item in items"')
		expect(component).toContain('#[item.value]')
		expect(component).toContain('<slot :name="item.value" />')
		expect(component).not.toMatch(/\$fetch|useFetch|useAsyncData|useQuery|useSubscription/)
	})

	it('matches record-analysis pill styling and accepts data-fed labels', () => {
		expect(component).toContain('variant="pill"')
		expect(component).toContain(
			'flex-wrap justify-start rounded-xl border border-border bg-card/60',
		)
		expect(component).toContain("content: 'pt-6 outline-none'")
		expect(model).toContain('value: T')
		expect(model).toContain('label: string')
	})
})

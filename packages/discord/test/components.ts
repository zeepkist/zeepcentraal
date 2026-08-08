import { expect } from 'bun:test'
import { MessageFlags } from 'discord.js'

type ComponentJson = {
	accessory?: ComponentJson
	components?: ComponentJson[]
	content?: string
	disabled?: boolean
	items?: ComponentJson[]
	label?: string
	type?: number
}

export function messageJson(value: unknown) {
	return JSON.parse(JSON.stringify(value)) as {
		components?: ComponentJson[]
		content?: string | null
		embeds?: unknown[]
		flags?: number
	}
}

function nestedComponents(component: ComponentJson): ComponentJson[] {
	return [
		component,
		...(component.accessory ? nestedComponents(component.accessory) : []),
		...(component.components ?? []).flatMap(nestedComponents),
		...(component.items ?? []).flatMap(nestedComponents),
	]
}

export function displayText(value: unknown) {
	return (messageJson(value).components ?? [])
		.flatMap(nestedComponents)
		.map((component) => component.content)
		.filter((content): content is string => typeof content === 'string')
		.join('\n')
}

export function allComponents(value: unknown) {
	return (messageJson(value).components ?? []).flatMap(nestedComponents)
}

export function expectComponentsV2(value: unknown, ephemeral = false) {
	const json = messageJson(value)
	expect(json.content).toBeUndefined()
	expect(json.embeds).toBeUndefined()
	expect((json.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2)
	expect((json.flags ?? 0) & MessageFlags.Ephemeral).toBe(ephemeral ? MessageFlags.Ephemeral : 0)
	expect(json.components).toHaveLength(1)
	const components = allComponents(value)
	expect(components.length).toBeLessThanOrEqual(40)
	expect(displayText(value).length).toBeLessThanOrEqual(4000)
	return json
}

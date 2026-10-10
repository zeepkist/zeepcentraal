import { rustTargets } from './scripts/release/targets.mjs'

const target = process.env.RELEASE_TARGET || 'ts'

if (target !== 'ts' && !Object.hasOwn(rustTargets, target)) {
	throw new Error(`Unknown release target: ${target}`)
}

export default {
	branches: ['develop'],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
	tagFormat: target === 'ts' ? '${version}' : `${target}@\${version}`,
	plugins: [
		'./scripts/release/impact.mjs',
		[
			'@semantic-release/github',
			{
				releasedLabels: [
					// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
					'released<%= nextRelease.channel ? ` on @${nextRelease.channel}` : "" %> from <%= branch.name %>',
				],
			},
		],
	],
}

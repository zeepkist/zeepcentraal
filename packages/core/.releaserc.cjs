module.exports = {
	extends: ['semantic-release-monorepo', '../../release.config.cjs'],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
	tagFormat: 'core@${version}',
}

import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
	schema: 'schema.graphql',
	documents: ['documents/**/*.graphql'],
	generates: {
		'src/generated/': {
			preset: 'client',
			presetConfig: { fragmentMasking: false },
			config: {
				documentMode: 'documentNode',
				useTypeImports: true,
			},
		},
	},
	ignoreNoDocuments: true,
}

export default config

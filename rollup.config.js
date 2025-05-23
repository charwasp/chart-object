import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.cjs',
		format: 'cjs',
		sourcemap: true,
		sourcemapExcludeSources: true, // src is included in files in package.json
	},
	plugins: [
		typescript({ tsconfig: 'tsconfig.rollup.json' }),
	],
};

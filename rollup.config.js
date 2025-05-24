import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import inject from '@rollup/plugin-inject';

const cjs = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.cjs',
		format: 'cjs',
		sourcemap: true,
		sourcemapExcludeSources: true, // src is included in files in package.json
	},
	plugins: [
		esbuild({
			tsconfig: 'tsconfig.rollup.json',
			minify: false,
		}),
	],
};

const iife = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.iife.js',
		format: 'iife',
		sourcemap: true,
		sourcemapExcludeSources: true,
		name: 'CharWasP',
		extend: true,
		inlineDynamicImports: true, // https://stackoverflow.com/a/68956884
	},
	plugins: [
		resolve({
			browser: true,
			preferBuiltins: false,
		}),
		commonjs(), // "PNG" is not exported by "node_modules/pngjs/lib/png.js"
		esbuild({
			tsconfig: 'tsconfig.rollup.json',
			minify: false,
		}),
		inject({ // inject cannot parse TypeScript, so it must be after esbuild
			Buffer: ['buffer', 'Buffer'], // pngjs uses Buffer global variable
		}),
		nodePolyfills(), // must come after inject to handle buffer module
	],
};

const iifeMin = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.iife.min.js',
		format: 'iife',
		sourcemap: true,
		sourcemapExcludeSources: true,
		name: 'CharWasP',
		extend: true,
		inlineDynamicImports: true,
	},
	plugins: [
		resolve({
			browser: true,
			preferBuiltins: false,
		}),
		commonjs(),
		esbuild({
			tsconfig: 'tsconfig.rollup.json',
			minify: false,
		}),
		inject({
			Buffer: ['buffer', 'Buffer'],
		}),
		nodePolyfills(),
		esbuild({
			minify: true,
		}),
	],
};

export default [cjs, iife, iifeMin];

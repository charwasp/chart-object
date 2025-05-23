import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';

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
		file: 'dist/index.iife.cjs',
		format: 'iife',
		sourcemap: true,
		sourcemapExcludeSources: true,
		name: 'CharWasP_chartObject',
		banner: 'globalThis.CharWasP ??= {};',
		footer: 'Object.assign(CharWasP, CharWasP_chartObject);',
		inlineDynamicImports: true, // https://stackoverflow.com/a/68956884
	},
	plugins: [
		resolve({
			browser: true,
			preferBuiltins: false,
		}),
		commonjs(),
		nodePolyfills(),
		esbuild({
			tsconfig: 'tsconfig.rollup.json',
			minify: false,
		}),
	],
};

const iifeMin = {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.iife.min.cjs',
		format: 'iife',
		sourcemap: true,
		sourcemapExcludeSources: true,
		name: 'CharWasP_chartObject',
		banner: 'globalThis.CharWasP ??= {};',
		footer: 'Object.assign(CharWasP, CharWasP_chartObject);',
		inlineDynamicImports: true,
	},
	plugins: [
		resolve({
			browser: true,
			preferBuiltins: false,
		}),
		commonjs(),
		nodePolyfills(),
		esbuild({
			tsconfig: 'tsconfig.rollup.json',
			minify: true,
		}),
	],
};

export default [cjs, iife, iifeMin];

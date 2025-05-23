import { decoders } from 'audio-decode';
import { PNG } from 'pngjs';

import { Chart } from './chart.js';
import type { Music } from './music.js';
import { encodeString, decodeString, stringEncodedLength } from './utils.js';

/**
 * The point of this class is to assist {@link FileEmbedded} to write the actual data of an embedded file later.
 * After {@link FileProvider.encode} is called, some of the data is still not written yet,
 * and they will be written later by calling {@link write}.
 */
class EmbedRequest {
	constructor(public arrayBuffer: ArrayBuffer | SharedArrayBuffer, public requestedOffset: number) {}

	length(): number {
		return this.arrayBuffer.byteLength;
	}

	/**
	 * Writes the data in {@link arrayBuffer} to `output`.
	 * It will revisit a previous location in `output` specified by {@link requestedOffset}
	 * to write down the offset and length information there.
	 * 
	 * @param output The output buffer to write to.
	 * @param offset The offset in the output buffer to start writing at.
	 */
	write(output: DataView, offset: number): number {
		output.setBigUint64(this.requestedOffset, BigInt(offset), true);
		output.setBigUint64(this.requestedOffset + 8, BigInt(this.length()), true);
		const input = new DataView(this.arrayBuffer);
		for (let i = 0; i < this.length(); i++) {
			output.setUint8(offset, input.getUint8(i));
			offset++;
		}
		return offset;
	}
}

abstract class Provider {
	abstract encodedLength(): number;

	/**
	 * If {@link EmbedRequest} objects are created when {@link encode} is called,
	 * the length returned by this method should include the lengths of those embedded files
	 * in addition to the length returned by {@link encodedLength}.
	 * 
	 * @returns The total length of the encoded data.
	 * 
	 * @see {@link FileProvider.encodedLength}
	 */
	totalEncodedLength(): number {
		return this.encodedLength();
	}

	/**
	 * In the return value, the first number is the new offset.
	 * The second value is an array of {@link EmbedRequest} objects,
	 * whose {@link EmbedRequest.write} method should be called later.
	 * 
	 * @param output The output buffer to write to.
	 * @param offset The offset in the output buffer to start writing at.
	 */
	abstract encode(output: DataView, offset: number): [number, EmbedRequest[]];
}

abstract class MusicProvider extends Provider {
	/**
	 * Returns the audio buffer of the music.
	 * 
	 * If `context` is provided, its `createBuffer` method will be used to create the audio buffer.
	 * 
	 * If `context` is not provided, the constructor of `AudioBuffer` will be used.
	 * In cases where `AudioBuffer` does not exist (e.g. usually outside of a browser),
	 * a shim implementation by [audio-buffer](https://www.npmjs.com/package/audio-buffer) will be used,
	 * which may cause some [issues](https://github.com/audiojs/audio-decode/pull/35#issuecomment-1655907036).
	 * If that happens, specify the `context` parameter.
	 * 
	 * @param context The audio context to use for creating the audio buffer.
	 * @returns The audio buffer containing the decoded audio data.
	 */
	abstract audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;

	static decode(music: Music, input: DataView, offset: number): MusicProvider {
		return new MusicFromFileProvider(FileProvider.decode(input, offset));
	}
}

abstract class PreviewProvider extends Provider {
	/**
	 * {@inheritDoc MusicProvider.audioBuffer}
	 */
	abstract audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;

	static decode(music: Music, input: DataView, offset: number): MusicProvider {
		switch (input.getInt8(offset)) {
			case 0:
				return PreviewFromMusicProvider.decode(music, input, offset);
			default:
				return new PreviewFromFileProvider(FileProvider.decode(input, offset));
		}
	}
}

abstract class CoverProvider extends Provider {
	/**
	 * If `context` is provided, its `createImageData` method will be used to create the image data.
	 * Otherwise, the constructor of `ImageData` will be used.
	 * If you are outside of a browser where `ImageData` does not exist,
	 * you need to provide the `context` parameter.
	 * 
	 * @param context The canvas context to use for creating the image data.
	 * @returns The image data of the cover.
	 */
	abstract imageData(context?: CanvasRenderingContext2D): Promise<ImageData>;

	static decode(music: Music, input: DataView, offset: number): CoverProvider {
		switch (input.getInt8(offset)) {
			case 0:
				return new CoverEmptyProvider();
			default:
				return new CoverFromFileProvider(FileProvider.decode(input, offset));
		}
	}
}

abstract class ChartProvider extends Provider {
	abstract chart(): Promise<Chart>;

	static decode(music: Music, input: DataView, offset: number): ChartProvider {
		return new ChartFromFileEmbedded(FileEmbedded.decode(input, offset));
	}
}

abstract class FileProvider {
	compressed = false;

	/**
	 * If {@link compressed} is `true`, it gives the decompressed data.
	 * Otherwise, it is the same as {@link arrayBuffer}.
	 */
	abstract originalArrayBuffer(): Promise<ArrayBuffer>;

	async arrayBuffer(): Promise<ArrayBuffer> {
		if (!this.compressed) {
			return await this.originalArrayBuffer();
		}
		return await new Response(
			new Blob([await this.originalArrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))
		).arrayBuffer();
	}

	abstract encodedLength(): number;

	/**
	 * In addition to {@link encodedLength}, this includes the length of data that will be written later
	 * by {@link EmbedRequest.write}.
	 */
	totalEncodedLength(): number {
		return this.encodedLength();
	}

	abstract encode(output: DataView, offset: number): [number, EmbedRequest[]];

	static decode(input: DataView, offset: number): FileProvider {
		const type = input.getInt8(offset);
		switch (type) {
			case 1:
			case -1:
				return FileEmbedded.decode(input, offset);
			case 2:
			case -2:
				return FileFromUrl.decode(input, offset);
			case 3:
			case -3:
				return FileFromPath.decode(input, offset);
		}
	}
}

class MusicFromFileProvider extends MusicProvider {
	constructor(public fileProvider: FileProvider) {
		super();
	}

	encodedLength(): number {
		return this.fileProvider.encodedLength();
	}

	totalEncodedLength(): number {
		return this.fileProvider.totalEncodedLength();
	}

	async audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer> {
		const buffer = await this.fileProvider.arrayBuffer();
		const decoded = await decoders.oga(new Uint8Array(buffer));
		if (!context) {
			return decoded;
		}
		const result = context.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
		for (let i = 0; i < decoded.numberOfChannels; i++) {
			result.copyToChannel(decoded.getChannelData(i), i);
		}
		return result;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		return this.fileProvider.encode(output, offset);
	}
}

class PreviewFromFileProvider extends PreviewProvider {
	constructor(public fileProvider: FileProvider) {
		super();
	}

	encodedLength(): number {
		return this.fileProvider.encodedLength();
	}

	totalEncodedLength(): number {
		return this.fileProvider.totalEncodedLength();
	}

	async audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer> {
		const buffer = await this.fileProvider.arrayBuffer();
		const decoded = await decoders.oga(new Uint8Array(buffer));
		if (!context) {
			return decoded;
		}
		const result = context.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
		for (let i = 0; i < decoded.numberOfChannels; i++) {
			result.copyToChannel(decoded.getChannelData(i), i);
		}
		return result;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		return this.fileProvider.encode(output, offset);
	}
}

class PreviewFromMusicProvider extends PreviewProvider {
	offset = 0;
	length = 441000;
	fadeInLength = 44100;
	fadeOutLength = 44100;

	constructor(public musicProvider: MusicProvider) {
		super();
	}

	async audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer> {
		const musicAudioBuffer = await this.musicProvider.audioBuffer(context);
		const { numberOfChannels, sampleRate } = musicAudioBuffer;
		const result = context?.createBuffer(numberOfChannels, this.length, sampleRate) ?? new AudioBuffer({ numberOfChannels, length: this.length, sampleRate });
		for (let i = 0; i < numberOfChannels; i++) {
			const source = musicAudioBuffer.getChannelData(i);
			const destination = result.getChannelData(i);
			for (let j = 0; j < this.length; j++) {
				const factor = Math.min((j + 1) / this.fadeInLength, (this.length - j) / this.fadeOutLength, 1);
				destination[j] = factor * source[j + this.offset];
			}
		}
		return result;
	}

	encodedLength(): number {
		return 25;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		output.setInt8(offset, 0);
		offset++;
		output.setBigUint64(offset, BigInt(this.offset), true);
		offset += 8;
		output.setBigUint64(offset, BigInt(this.length), true);
		offset += 8;
		output.setUint32(offset, this.fadeInLength, true);
		offset += 4;
		output.setUint32(offset, this.fadeOutLength, true);
		offset += 4;
		return [offset, []];
	}

	static decode(music: Music, input: DataView, offset: number): PreviewFromMusicProvider {
		offset++;
		const result = new PreviewFromMusicProvider(music.musicProvider);
		result.offset = Number(input.getBigUint64(offset, true));
		offset += 8;
		result.length = Number(input.getBigUint64(offset, true));
		offset += 8;
		result.fadeInLength = input.getUint32(offset, true);
		offset += 4;
		result.fadeOutLength = input.getUint32(offset, true);
		offset += 4;
		return result;
	}
}

class CoverEmptyProvider extends CoverProvider {
	async imageData(context?: CanvasRenderingContext2D): Promise<ImageData> {
		return context?.createImageData(1, 1) ?? new ImageData(1, 1);
	}

	encodedLength(): number {
		return 1;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		output.setInt8(offset, 0);
		offset++;
		return [offset, []];
	}
}

class CoverFromFileProvider extends CoverProvider {
	constructor(public fileProvider: FileProvider) {
		super();
	}

	async imageData(context?: CanvasRenderingContext2D): Promise<ImageData> {
		const buffer = await this.fileProvider.arrayBuffer();
		const png: PNG = await new Promise((resolve, reject) => new PNG().parse(
			Buffer.from(buffer), // may not work in browser, need browserify
			(error, data) => error ? reject(error) : resolve(data)
		));
		const result = context?.createImageData(png.width, png.height) ?? new ImageData(png.width, png.height);
		result.data.set(png.data);
		return result;
	}

	encodedLength(): number {
		return this.fileProvider.encodedLength();
	}

	totalEncodedLength(): number {
		return this.fileProvider.totalEncodedLength();
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		return this.fileProvider.encode(output, offset);
	}
}

class ChartFromFileEmbedded extends ChartProvider {
	constructor(public fileEmbedded: FileEmbedded) {
		super();
	}

	async chart(): Promise<Chart> {
		const buffer = await this.fileEmbedded.arrayBuffer();
		return Chart.decode(new DataView(buffer), 0);
	}

	encodedLength(): number {
		return this.fileEmbedded.encodedLength();
	}

	totalEncodedLength(): number {
		return this.fileEmbedded.totalEncodedLength();
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		return this.fileEmbedded.encode(output, offset);
	}
}

class FileEmbedded extends FileProvider {
	internalArrayBuffer: ArrayBuffer;

	/**
	 * Creates an instance.
	 * This will make {@link internalArrayBuffer} a copy of part of `original`.
	 * If `original` is a `SharedArrayBuffer`, it will be converted to an `ArrayBuffer`.
	 * 
	 * @param original The original buffer to copy from.
	 * @param offset The offset in the original buffer to start copying from.
	 * @param length The length of the data to copy.
	 */
	constructor(original: ArrayBuffer | SharedArrayBuffer = new ArrayBuffer(0), offset = 0, length = original.byteLength) {
		super();
		const source = new Uint8Array(original, offset, length);
		const destination = new Uint8Array(length);
		destination.set(source); // converts SharedArrayBuffer to ArrayBuffer
		this.internalArrayBuffer = destination.buffer;
	}

	async originalArrayBuffer(): Promise<ArrayBuffer> {
		return this.internalArrayBuffer;
	}

	/**
	 * This changes {@link internalArrayBuffer}.
	 * No matter what the value of {@link compressed} is, `arrayBuffer` needs to be uncompressed data.
	 * This method does the compression if necessary before setting {@link internalArrayBuffer}.
	 * 
	 * @param arrayBuffer The new data to set.
	 */
	async set(arrayBuffer: ArrayBuffer): Promise<void> {
		if (!this.compressed) {
			this.internalArrayBuffer = arrayBuffer;
			return;
		}
		this.internalArrayBuffer = await new Response(
			new Blob([arrayBuffer]).stream().pipeThrough(new CompressionStream('gzip'))
		).arrayBuffer();
	}

	encodedLength(): number {
		return 17;
	}

	totalEncodedLength(): number {
		return this.encodedLength() + this.internalArrayBuffer.byteLength;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		output.setInt8(offset, this.compressed ? -1 : 1);
		offset++;
		const embedRequest = new EmbedRequest(this.internalArrayBuffer, offset);
		offset += 16;
		return [offset, [embedRequest]];
	}

	static decode(input: DataView, offset: number): FileEmbedded {
		const compressed = input.getInt8(offset) < 0;
		offset++;
		const embedOffset = Number(input.getBigUint64(offset, true));
		offset += 8;
		const embedLength = Number(input.getBigUint64(offset, true));
		offset += 8;
		const result = new FileEmbedded(input.buffer, embedOffset + input.byteOffset, embedLength);
		result.compressed = compressed;
		return result;
	}
}

class FileFromUrl extends FileProvider {
	constructor(public url: string) {
		super();
	}

	async originalArrayBuffer(): Promise<ArrayBuffer> {
		const response = await fetch(this.url);
		if (!response.ok) {
			throw new Error(`Failed to fetch music file: ${response.statusText}`);
		}
		return await response.arrayBuffer();
	}

	encodedLength(): number {
		return 1 + stringEncodedLength(this.url);
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		output.setInt8(offset, this.compressed ? -2 : 2);
		offset++;
		offset = encodeString(this.url, output, offset);
		return [offset, []];
	}

	static decode(input: DataView, offset: number): FileFromUrl {
		const compressed = input.getInt8(offset) < 0;
		offset++;
		const result = new FileFromUrl(decodeString(input, offset));
		result.compressed = compressed;
		return result;
	}
}

class FileFromPath extends FileProvider {
	static base: string;
	constructor(public path: string) {
		super();
	}

	async originalArrayBuffer(): Promise<ArrayBuffer> {
		const base = FileFromPath.base;
		if (FileFromPath.base === undefined) {
			throw new Error("Base URL not set for relative path");
		}
		if (base.startsWith("http://") || base.startsWith("https://") || base.startsWith("file://")) {
			const response = await fetch(`${base}/${this.path}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch music file: ${response.statusText}`);
			}
			return await response.arrayBuffer();
		}
		if (typeof window !== "undefined") {
			throw new Error("Relative paths are not supported in the browser");
		}
		return (await import('fs')).readFileSync(`${base}/${this.path}`).buffer;
	}

	encodedLength(): number {
		return 1 + stringEncodedLength(this.path);
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		output.setInt8(offset, this.compressed ? -3 : 3);
		offset++;
		offset = encodeString(this.path, output, offset);
		return [offset, []];
	}

	static decode(input: DataView, offset: number): FileFromPath {
		const compressed = input.getInt8(offset) < 0;
		offset++;
		const result = new FileFromPath(decodeString(input, offset));
		result.compressed = compressed;
		return result;
	}
}

export {
	EmbedRequest,
	Provider,
	MusicProvider,
	PreviewProvider,
	CoverProvider,
	ChartProvider,
	FileProvider,
	MusicFromFileProvider,
	PreviewFromFileProvider,
	PreviewFromMusicProvider,
	CoverEmptyProvider,
	CoverFromFileProvider,
	ChartFromFileEmbedded,
	FileEmbedded,
	FileFromUrl,
	FileFromPath
};

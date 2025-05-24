import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import { Chart } from './chart.js';
import type { Music } from './music.js';
/**
 * The point of this class is to assist {@link FileEmbedded} to write the actual data of an embedded file later.
 * After {@link FileProvider.encode} is called, some of the data is still not written yet,
 * and they will be written later by calling {@link write}.
 */
declare class EmbedRequest {
    arrayBuffer: ArrayBuffer | SharedArrayBuffer;
    requestedOffset: number;
    constructor(arrayBuffer: ArrayBuffer | SharedArrayBuffer, requestedOffset: number);
    length(): number;
    /**
     * Writes the data in {@link arrayBuffer} to `output`.
     * It will revisit a previous location in `output` specified by {@link requestedOffset}
     * to write down the offset and length information there.
     *
     * @param output The output buffer to write to.
     * @param offset The offset in the output buffer to start writing at.
     */
    write(output: DataView, offset: number): number;
}
/**
 * A provider is an object that provides necessary data for presenting a music,
 * such as the music itself ({@link MusicProvider}),
 * the preview ({@link PreviewProvider}), the cover image ({@link CoverProvider}),
 * and the chart ({@link ChartProvider}).
 * It can be encoded to a binary format (through the method {@link encode}),
 * which is a description of the provenance of the data enough to reconstruct the actual data.
 */
declare abstract class Provider {
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
    totalEncodedLength(): number;
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
declare abstract class AudioProvider extends Provider {
    /**
     * Returns the audio buffer of the music.
     *
     * If `context` is provided, its `createBuffer` method will be used to create the audio buffer.
     *
     * If `context` is not provided, the constructor of `AudioBuffer` will be used.
     * When `AudioBuffer` does not exist (usually happens when outside of a browser),
     * you must provide the `context` parameter.
     *
     * @param context The audio context to use for creating the audio buffer.
     * @returns The audio buffer containing the decoded audio data.
     */
    abstract audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;
    static decoder: OggVorbisDecoder;
    /**
     * Uses [@wasm-audio-decoders/ogg-vorbis](https://www.npmjs.com/package/@wasm-audio-decoders/ogg-vorbis)
     * to decode audio data in Ogg Vorbis format.
     *
     * See {@link audioBuffer} for how the parameter `context` is used.
     *
     * @param arrayBuffer The array buffer containing the audio data in Ogg Vorbis format.
     * @param context The audio context to use for creating the audio buffer.
     * @returns The decoded audio buffer.
     */
    static decodeAudio(arrayBuffer: ArrayBuffer, context?: BaseAudioContext): Promise<AudioBuffer>;
}
declare abstract class MusicProvider extends AudioProvider {
    static decode(music: Music, input: DataView, offset: number): MusicProvider;
}
declare abstract class PreviewProvider extends AudioProvider {
    static decode(music: Music, input: DataView, offset: number): MusicProvider;
}
declare abstract class CoverProvider extends Provider {
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
    static decode(music: Music, input: DataView, offset: number): CoverProvider;
}
declare abstract class ChartProvider extends Provider {
    abstract chart(): Promise<Chart>;
    static decode(music: Music, input: DataView, offset: number): ChartProvider;
}
/**
 * A file provider is an object that has the following two features:
 *
 * - It can provide binary data (through the method {@link arrayBuffer}).
 * - It can be encoded to a binary format (through the method {@link encode}),
 *   which is a description of the provenance of the data.
 *
 * The data provided by {@link arrayBuffer} is not necessarily the same as the data encoded by {@link encode}.
 * The latter only need to describe a provenance of the data, enough to reconstruct the actual data.
 * For example, a URL or a file path can suffice.
 */
declare abstract class FileProvider {
    compressed: boolean;
    /**
     * If {@link compressed} is `true`, it gives the decompressed data.
     * Otherwise, it is the same as {@link arrayBuffer}.
     */
    abstract originalArrayBuffer(): Promise<ArrayBuffer>;
    arrayBuffer(): Promise<ArrayBuffer>;
    abstract encodedLength(): number;
    /**
     * In addition to {@link encodedLength}, this includes the length of data that will be written later
     * by {@link EmbedRequest.write}.
     */
    totalEncodedLength(): number;
    /**
     * Encodes the file provider to a binary format.
     *
     * @param output The output buffer to write to.
     * @param offset The offset in the output buffer to start writing at.
     * @returns A tuple containing the new offset and an array of {@link EmbedRequest} objects.
     * For the use of the latter, see {@link Provider.encode}.
     */
    abstract encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): FileProvider;
}
declare class MusicFromFileProvider extends MusicProvider {
    fileProvider: FileProvider;
    constructor(fileProvider: FileProvider);
    encodedLength(): number;
    totalEncodedLength(): number;
    audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
}
declare class PreviewFromFileProvider extends PreviewProvider {
    fileProvider: FileProvider;
    constructor(fileProvider: FileProvider);
    encodedLength(): number;
    totalEncodedLength(): number;
    audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
}
/**
 * The preview is derived from a segment of the original music data.
 */
declare class PreviewFromMusicProvider extends PreviewProvider {
    musicProvider: MusicProvider;
    /**
     * The offset in the original music data to start copying from.
     * Measured in audio frames.
     */
    offset: number;
    /**
     * The length of the preview.
     * Measured in audio frames.
     */
    length: number;
    /**
     * The length of the linear fade-in effect. Set to zero to disable fade-in.
     * Measured in audio frames.
     */
    fadeInLength: number;
    /**
     * The length of the linear fade-out effect. Set to zero to disable fade-out.
     * Measured in audio frames.
     */
    fadeOutLength: number;
    constructor(musicProvider: MusicProvider);
    audioBuffer(context?: BaseAudioContext): Promise<AudioBuffer>;
    encodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(music: Music, input: DataView, offset: number): PreviewFromMusicProvider;
}
/**
 * Its {@link imageData} always returns a 1x1 transparent image.
 */
declare class CoverEmptyProvider extends CoverProvider {
    imageData(context?: CanvasRenderingContext2D): Promise<ImageData>;
    encodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
}
/**
 * This class provides a cover image from a PNG file provided by {@link fileProvider}.
 * It uses the [pngjs](https://www.npmjs.com/package/pngjs) library to decode the PNG file.
 */
declare class CoverFromFileProvider extends CoverProvider {
    fileProvider: FileProvider;
    constructor(fileProvider: FileProvider);
    imageData(context?: CanvasRenderingContext2D): Promise<ImageData>;
    encodedLength(): number;
    totalEncodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
}
declare class ChartFromFileEmbedded extends ChartProvider {
    fileEmbedded: FileEmbedded;
    constructor(fileEmbedded: FileEmbedded);
    chart(): Promise<Chart>;
    encodedLength(): number;
    totalEncodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
}
declare class FileEmbedded extends FileProvider {
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
    constructor(original?: ArrayBuffer | SharedArrayBuffer, offset?: number, length?: number);
    originalArrayBuffer(): Promise<ArrayBuffer>;
    /**
     * This changes {@link internalArrayBuffer}.
     * No matter what the value of {@link compressed} is, `arrayBuffer` needs to be uncompressed data.
     * This method does the compression if necessary before setting {@link internalArrayBuffer}.
     *
     * @param arrayBuffer The new data to set.
     */
    set(arrayBuffer: ArrayBuffer): Promise<void>;
    encodedLength(): number;
    totalEncodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): FileEmbedded;
}
declare class FileFromUrl extends FileProvider {
    url: string;
    constructor(url: string);
    originalArrayBuffer(): Promise<ArrayBuffer>;
    encodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): FileFromUrl;
}
declare class FileFromPath extends FileProvider {
    path: string;
    static base: string;
    constructor(path: string);
    originalArrayBuffer(): Promise<ArrayBuffer>;
    encodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): FileFromPath;
}
export { EmbedRequest, Provider, MusicProvider, PreviewProvider, CoverProvider, ChartProvider, FileProvider, MusicFromFileProvider, PreviewFromFileProvider, PreviewFromMusicProvider, CoverEmptyProvider, CoverFromFileProvider, ChartFromFileEmbedded, FileEmbedded, FileFromUrl, FileFromPath };

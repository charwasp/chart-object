import { ChartList } from './chart.js';
import { MusicProvider, PreviewProvider, CoverProvider } from './provider.js';
declare class Music {
    musicProvider: MusicProvider;
    previewProvider: PreviewProvider;
    coverProvider: CoverProvider;
    /**
     * The name of the music.
     */
    name: string;
    /**
     * The artist of the music.
     */
    artist: string;
    /**
     * The categories of the music represented as a bitmask.
     * All possible flags are:
     *
     * | Flag | Meaning |
     * |-|-|
     * | `2` | |
     * | `4` | {@link instrumental} |
     * | `8` | {@link vocal} |
     * | `16` | |
     */
    categories: number;
    /**
     * Keywords that intend to assist searching.
     */
    keywords: string[];
    chartList: ChartList;
    constructor(musicProvider: MusicProvider, previewProvider: PreviewProvider, coverProvider: CoverProvider);
    /**
     * Implemented as reading the bitmask in {@link categories}.
     */
    get instrumental(): boolean;
    /**
     * Implemented as writing the bitmask in {@link categories}.
     */
    set instrumental(value: boolean);
    /**
     * Implemented as reading the bitmask in {@link categories}.
     */
    get vocal(): boolean;
    /**
     * Implemented as writing the bitmask in {@link categories}.
     */
    set vocal(value: boolean);
    newChart(difficultyName: string): import("./chart.js").ChartInfo;
    getChartInfo(difficultyName: string): import("./chart.js").ChartInfo;
    chartCount(): number;
    encodedLength(): number;
    encode(output: DataView, offset: number): number;
    static decode(input: DataView, offset: number): Music;
}
export { Music };

import { Fraction } from "fraction.js";
import { BpsList } from "./bps.js";
import { SpeedList } from "./speed.js";
import { NoteList } from "./note.js";
import { ChartProvider, EmbedRequest } from "./provider.js";
import type { Cbt } from "./cbt.js";
declare class Chart {
    /**
     * The chart author's name.
     */
    charter: string;
    /**
     * Any comments about the chart.
     */
    comments: string;
    /**
     * The offset of the chart in seconds.
     * This is the time in the music when the zeroth beat happens.
     */
    offset: number;
    bpsList: BpsList;
    speedList: SpeedList;
    noteList: NoteList;
    constructor(offset?: number, initialBps?: number, initialSpeed?: number);
    /**
     * The y coordinate of a chart at some time is defined by the position of a 1D particle at that time
     * assuming that its velocity is piecewisely specified by the {@link speedList}.
     *
     * @param time The time at which to find the y coordinate.
     * @returns The y coordinate at the given time.
     */
    yAt(time: number): number;
    /**
     * Similar to {@link yAt}, but takes a beat instead of time as the parameter.
     *
     * @param beat The beat at which to find the y coordinate.
     * @returns The y coordinate at the given beat.
     */
    yAtBeat(beat: Fraction): number;
    encodedLength(): number;
    encode(output: DataView, offset: number): number;
    static decode(input: DataView, offset: number): Chart;
    private beatToCbt;
    toCbt(beatsPerMeasure?: number): Cbt;
    static fromCbt(cbt: Cbt, beatsPerMeasure?: number): Chart;
}
/**
 * This object contains the metadata of a chart (except for the chart author's name and the comments).
 * It is used to provide the information of a chart that may be needed without actually loading the chart.
 * For actual data of a chart, see {@link Chart}.
 */
declare class ChartInfo {
    /**
     * The name of the difficulty.
     * Usually one of `"EASY"`, `"NORMAL"`, `"HARD"`, `"EXTRA"`, `"EXTRA+"`, `"CHAOS"`, `"CHAOS+"`.
     */
    difficultyName: string;
    /**
     * The text describing the difficulty level.
     * Usually the decimal representation of an integer from 1 to 13.
     */
    difficultyText: string;
    /**
     * The color of this difficulty. Common values:
     *
     * | Difficulty name | Color |
     * |-|-|
     * | EASY | `[0x00, 0x41, 0xe9]` |
     * | NORMAL | `[0xe9, 0x6e, 0x00]` |
     * | HARD | `[0xe9, 0x00, 0x2e]` |
     * | EXTRA, EXTRA+ | `[0xe9, 0x00, 0xad]` |
     * | CHAOS, CHAOS+ | `[0x4b, 0x4b, 0x9d]` |
     */
    difficultyColor: number[];
    /**
     * A number that quantitatively describes the difficulty of this chart.
     * It should be 1000 times the actual difficulty level.
     * For example, if the difficulty level is 12.9, then this number should be 12900.
     */
    difficulty: number;
    chartProvider: ChartProvider;
    private _chart;
    constructor();
    /**
     * This loads the actual chart data by decoding them from {@link chartProvider}.
     * The decoding only happens once, and then the chart is cached
     * so that the promise from subsequent calls resolves immediately.
     *
     * @returns Loaded chart.
     */
    chart(): Promise<Chart>;
    /**
     * This replaces the chart data.
     * After this function is called, {@link chartProvider} will be set to `null`
     * (it will later be set to a new object when {@link encode} is called).
     *
     * @param value The new chart.
     */
    setChart(value: Chart): void;
    encodedLength(): number;
    /**
     * @see {@link Provider.totalEncodedLength}
     * @see {@link FileProvider.totalEncodedLength}
     */
    totalEncodeLength(): number;
    encode(output: DataView, offset: number, compressed?: boolean): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): ChartInfo;
}
declare class ChartList {
    charts: Map<string, ChartInfo>;
    newChart(difficultyName: string): ChartInfo;
    getChartInfo(difficultyName: string): ChartInfo;
    encodedLength(): number;
    totalEncodedLength(): number;
    encode(output: DataView, offset: number): [number, EmbedRequest[]];
    static decode(input: DataView, offset: number): ChartList;
}
export { Chart, ChartInfo, ChartList };

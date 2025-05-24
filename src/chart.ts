import { Fraction } from "fraction.js";

import { BpsList } from "./bps.js";
import { SpeedList } from "./speed.js";
import { Note, Tap, Hold, Drag, NoteList } from "./note.js";
import { ChartFromFileEmbedded, ChartProvider, FileEmbedded, EmbedRequest } from "./provider.js";
import type { Music } from "./music.js";
import type { Cbt } from "./cbt.js";
import { encodeString, decodeString, stringEncodedLength } from "./utils.js";

class Chart {

	/**
	 * The chart author's name.
	 */
	charter: string = "";

	/**
	 * Any comments about the chart.
	 */
	comments: string = "";

	/**
	 * The offset of the chart in seconds.
	 * This is the time in the music when the zeroth beat happens.
	 */
	offset: number;

	bpsList: BpsList;
	speedList: SpeedList;
	noteList: NoteList;

	constructor(offset = 0, initialBps = 2, initialSpeed = 1) {
		this.offset = offset;
		this.bpsList = new BpsList(initialBps);
		this.speedList = new SpeedList(initialSpeed);
		this.noteList = new NoteList();
	}

	/**
	 * The y coordinate of a chart at some time is defined by the position of a 1D particle at that time
	 * assuming that its velocity is piecewisely specified by the {@link speedList}.
	 * 
	 * @param time The time at which to find the y coordinate.
	 * @returns The y coordinate at the given time.
	 */
	yAt(time: number): number {
		return this.speedList.yAt(time, this.bpsList);
	}

	/**
	 * Similar to {@link yAt}, but takes a beat instead of time as the parameter.
	 * 
	 * @param beat The beat at which to find the y coordinate.
	 * @returns The y coordinate at the given beat.
	 */
	yAtBeat(beat: Fraction): number {
		return this.yAt(this.bpsList.timeAt(beat));
	}

	encodedLength(): number {
		return 4 + 1 + new TextEncoder().encode(this.charter).length + 1 +
			new TextEncoder().encode(this.comments).length + 1 + 8 +
			this.bpsList.encodedLength() + this.speedList.encodedLength() +
			this.noteList.encodedLength();
	}

	encode(output: DataView, offset: number): number {
		output.setUint32(offset, 0x43505743, true); // CPWC
		offset += 4;
		output.setUint8(offset, 1); // version
		offset++;
		offset = encodeString(this.charter, output, offset);
		offset = encodeString(this.comments, output, offset);
		output.setFloat64(offset, this.offset);
		offset += 8;
		offset = this.bpsList.encode(output, offset);
		offset = this.speedList.encode(output, offset);
		offset = this.noteList.encode(output, offset);
		return offset;
	}

	static decode(input: DataView, offset: number): Chart {
		const chart = new Chart();
		offset += 4; // magic number
		if (input.getUint8(offset) !== 1) {
			throw new Error("Unsupported version");
		}
		offset++;
		chart.charter = decodeString(input, offset);
		offset += stringEncodedLength(chart.charter);
		chart.comments = decodeString(input, offset);
		offset += stringEncodedLength(chart.comments);
		chart.offset = input.getFloat64(offset, true);
		offset += 8;
		chart.bpsList = BpsList.decode(input, offset);
		offset += chart.bpsList.encodedLength();
		chart.speedList = SpeedList.decode(input, offset);
		offset += chart.speedList.encodedLength();
		chart.noteList = NoteList.decode(input, offset);
		return chart;
	}

	private beatToCbt(beat: Fraction, startingMeasure = 0, beatsPerMeasure = 4): [number, number, number] {
		const beatsPerMeasureFraction = new Fraction(beatsPerMeasure);
		const measure = beat.div(beatsPerMeasureFraction).floor();
		const beatInMeasure = beat.sub(measure.mul(beatsPerMeasureFraction)).div(beatsPerMeasureFraction);
		return [measure.valueOf() - startingMeasure, Number(beatInMeasure.n), Number(beatInMeasure.d)];
	} 

	toCbt(beatsPerMeasure = 4): Cbt {
		const info = {
			bpm: this.bpsList.initialBpm()*beatsPerMeasure/4,
			delay: 0,
			dir: ""
		};
		const offsetBeat = new Fraction(-this.offset * this.bpsList.initialBps);
		const startingMeasure = Math.min(Math.floor(-this.offset * this.bpsList.initialBps / beatsPerMeasure), 0);
		const [measure, subdivision, subdivisionCount] = this.beatToCbt(offsetBeat, startingMeasure, beatsPerMeasure);
		const notes = [[measure, 8, subdivisionCount, 0, subdivision, 1, 'bgm']];
		for (const bpsChange of this.bpsList.bpsChanges) {
			const [measure, subdivision, subdivisionCount] = this.beatToCbt(bpsChange.beat, startingMeasure, beatsPerMeasure);
			notes.push([measure, 8, subdivisionCount, 0, subdivision, 2, bpsChange.bpm()*beatsPerMeasure/4]);
		}
		if (this.speedList.initialSpeed !== 1) {
			notes.push([0, 8, 4, 0, 0, 3, this.speedList.initialSpeed]);
		}
		for (const speedChange of this.speedList.speedChanges) {
			const [measure, subdivision, subdivisionCount] = this.beatToCbt(speedChange.beat, startingMeasure, beatsPerMeasure);
			notes.push([measure, 8, subdivisionCount, 0, subdivision, 3, speedChange.speed]);
		}
		let group = 0;
		const groups = new WeakMap<Hold[] | Drag[], number>();
		for (const note of this.noteList.notes) {
			const [measure, subdivision, subdivisionCount] = this.beatToCbt(note.beat, startingMeasure, beatsPerMeasure);
			const basicArgs = [measure, note.trackCount, subdivisionCount, note.trackIndex, subdivision];
			if (note instanceof Tap) {
				notes.push([...basicArgs, ...(note.width > 0 ? [40, note.width] : [10])]);
				continue;
			}
			const n = note as Hold | Drag;
			if (!groups.has(n.peers)) {
				groups.set(n.peers, group++);
			}
			let type: number;
			const args = [groups.get(n.peers)];
			if (n instanceof Hold) {
				if (n.isBegin()) {
					type = 20;
				} else if (n.isEnd()) {
					type = 21;
				} else {
					type = 22;
				}
				if (n.width > 0) {
					type += 30;
					args.push(n.width);
				}
			} else { // Drag
				if (!n.isBegin() && !n.isEnd()) {
					type = 31;
				} else if (n.isBegin()) {
					type = 30;
				} else {
					type = 32;
				}
			}
			notes.push([...basicArgs, type, ...args]);
		}
		return { info, notes } as Cbt;
	}

	static fromCbt(cbt: Cbt, beatsPerMeasure = 4): Chart {
		const chart = new Chart();
		chart.bpsList.initialBps = cbt.info.bpm / 60 * 4 / beatsPerMeasure;
		let offsetBeat: Fraction;
		const groups = new Map<number, Hold | Drag>();
		for (const [measure, trackCount, subdivisionCount, trackIndex, subdivision, type, ...args] of cbt.notes) {
			const beat = new Fraction(measure * beatsPerMeasure, 1).add(subdivision*beatsPerMeasure, subdivisionCount);
			let note: Note;
			let group: number;
			switch (type) {
				case 1:
					offsetBeat = beat;
					break;
				case 2:
					chart.bpsList.addBpmChange(beat, (args as number[])[0]);
					break;
				case 3:
					chart.speedList.addSpeedChange(beat, (args as number[])[0]);
					break;
				case 10:
				case 40:
					note = new Tap(beat, trackCount, trackIndex);
					chart.noteList.addNote(note);
					if (type === 40) {
						note.width = (args as number[])[0];
					}
					break;
				case 20:
				case 21:
				case 22:
				case 50:
				case 51:
					note = new Hold(beat, trackCount, trackIndex);
					chart.noteList.addNote(note);
					if (type === 50 || type === 51) {
						note.width = (args as number[])[1];
					}
					group = (args as number[])[0];
					if (groups.has(group)) {
						(note as Hold).mergeWith(groups.get(group) as Hold);
					} else {
						groups.set(group, note as Hold);
					}
					break;
				case 30:
				case 31:
				case 32:
					note = new Drag(beat, trackCount, trackIndex);
					chart.noteList.addNote(note);
					group = (args as number[])[0];
					if (groups.has(group)) {
						(note as Drag).mergeWith(groups.get(group) as Drag);
					} else {
						groups.set(group, note as Drag);
					}
					break;
			}
		}
		if (offsetBeat) {
			chart.offset = -chart.bpsList.timeAt(offsetBeat);
		}
		return chart;
	}
}

/**
 * This object contains the metadata of a chart (except for the chart author's name and the comments).
 * It is used to provide the information of a chart that may be needed without actually loading the chart.
 * For actual data of a chart, see {@link Chart}.
 */
class ChartInfo {

	/**
	 * The name of the difficulty.
	 * Usually one of `"EASY"`, `"NORMAL"`, `"HARD"`, `"EXTRA"`, `"EXTRA+"`, `"CHAOS"`, `"CHAOS+"`.
	 */
	difficultyName = 'EXTRA';

	/**
	 * The text describing the difficulty level.
	 * Usually the decimal representation of an integer from 1 to 13.
	 */
	difficultyText = '10';

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
	difficultyColor = [0xe9, 0x00, 0xad];

	/**
	 * A number that quantitatively describes the difficulty of this chart.
	 * It should be 1000 times the actual difficulty level.
	 * For example, if the difficulty level is 12.9, then this number should be 12900.
	 */
	difficulty = 10000;

	chartProvider: ChartProvider;

	private _chart: Chart;

	constructor() {}

	/**
	 * This loads the actual chart data by decoding them from {@link chartProvider}.
	 * The decoding only happens once, and then the chart is cached
	 * so that the promise from subsequent calls resolves immediately.
	 * 
	 * @returns Loaded chart.
	 */
	async chart(): Promise<Chart> {
		if (this._chart) {
			return this._chart;
		}
		this._chart = await this.chartProvider.chart();
		return this._chart;
	}

	/**
	 * This replaces the chart data.
	 * After this function is called, {@link chartProvider} will be set to `null`
	 * (it will later be set to a new object when {@link encode} is called).
	 * 
	 * @param value The new chart.
	 */
	setChart(value: Chart) {
		this._chart = value;
		this.chartProvider = null;
	}

	encodedLength(): number {
		return stringEncodedLength(this.difficultyName) +
			stringEncodedLength(this.difficultyText) + 3 + 4 +
			(this.chartProvider?.encodedLength() ?? 16);
	}

	/**
	 * @see {@link Provider.totalEncodedLength}
	 * @see {@link FileProvider.totalEncodedLength}
	 */
	totalEncodeLength(): number {
		return stringEncodedLength(this.difficultyName) +
			stringEncodedLength(this.difficultyText) + 3 + 4 +
			(this.chartProvider?.totalEncodedLength() ?? 17 + this._chart.encodedLength());
	}

	encode(output: DataView, offset: number, compressed = false): [number, EmbedRequest[]] {
		if (!this.chartProvider) {
			const arrayBuffer = new ArrayBuffer(this._chart.encodedLength());
			this._chart.encode(new DataView(arrayBuffer), 0);
			const fileEmbedded = new FileEmbedded();
			fileEmbedded.compressed = compressed;
			fileEmbedded.set(arrayBuffer);
			this.chartProvider = new ChartFromFileEmbedded(fileEmbedded);
		}
		offset = encodeString(this.difficultyName, output, offset);
		offset = encodeString(this.difficultyText, output, offset);
		for (let i = 0; i < 3; i++) {
			output.setUint8(offset, this.difficultyColor[i]);
			offset++;
		}
		output.setUint32(offset, this.difficulty, true);
		offset += 4;
		return this.chartProvider.encode(output, offset);
	}

	static decode(input: DataView, offset: number): ChartInfo {
		const chartInfo = new ChartInfo();
		chartInfo.difficultyName = decodeString(input, offset);
		offset += stringEncodedLength(chartInfo.difficultyName);
		chartInfo.difficultyText = decodeString(input, offset);
		offset += stringEncodedLength(chartInfo.difficultyText);
		for (let i = 0; i < 3; i++) {
			chartInfo.difficultyColor[i] = input.getUint8(offset);
			offset++;
		}
		chartInfo.difficulty = input.getUint32(offset, true);
		offset += 4;
		chartInfo.chartProvider = ChartProvider.decode(null, input, offset);
		return chartInfo;
	}
}

class ChartList {
	charts: Map<string, ChartInfo> = new Map();

	newChart(difficultyName: string) {
		const chartInfo = new ChartInfo();
		chartInfo.difficultyName = difficultyName;
		chartInfo.setChart(new Chart());
		this.charts.set(difficultyName, chartInfo);
		return chartInfo;
	}

	getChartInfo(difficultyName: string): ChartInfo {
		return this.charts.get(difficultyName);
	}

	encodedLength(): number {
		let length = 1; // chart count
		for (const chartInfo of this.charts.values()) {
			length += chartInfo.encodedLength();
		}
		return length;
	}

	totalEncodedLength(): number {
		let length = 1; // chart count
		for (const chartInfo of this.charts.values()) {
			length += chartInfo.totalEncodeLength();
		}
		return length;
	}

	encode(output: DataView, offset: number): [number, EmbedRequest[]] {
		const embedRequests: EmbedRequest[] = [];
		output.setUint8(offset, this.charts.size);
		offset++;
		let newEmbedRequests: EmbedRequest[];
		for (const chartInfo of this.charts.values()) {
			[offset, newEmbedRequests] = chartInfo.encode(output, offset);
			embedRequests.push(...newEmbedRequests);
		}
		return [offset, embedRequests];
	}

	static decode(input: DataView, offset: number): ChartList {
		const chartList = new ChartList();
		const chartCount = input.getUint8(offset);
		offset++;
		for (let i = 0; i < chartCount; i++) {
			const chartInfo = ChartInfo.decode(input, offset);
			offset += chartInfo.encodedLength();
			chartList.charts.set(chartInfo.difficultyName, chartInfo);
		}
		return chartList;
	}
}

export { Chart, ChartInfo, ChartList };

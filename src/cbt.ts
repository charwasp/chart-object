/**
 * See [format specification](../documents/format-specification.md#cbt-format) for details.
 */
interface Cbt {
	info: {
		bpm: number;
		dir: string;
		delay: number;
	};
	notes: (
		// [measure, trackCount, subdivisionCount, trackIndex, subdivisionIndex, type, ...args]
		| [number, number, number, number, number,  1, string]         // music
		| [number, number, number, number, number,  2, number]         // BPM change
		| [number, number, number, number, number,  3, number]         // speed change
		| [number, number, number, number, number, 10]                 // tap
		| [number, number, number, number, number, 20, number]         // hold begin
		| [number, number, number, number, number, 21, number]         // hold end
		| [number, number, number, number, number, 22, number]         // hold middle
		| [number, number, number, number, number, 30, number]         // drag begin
		| [number, number, number, number, number, 31, number]         // drag middle
		| [number, number, number, number, number, 32, number]         // drag end
		| [number, number, number, number, number, 40, number]         // wide tap
		| [number, number, number, number, number, 50, number, number] // wide hold begin
		| [number, number, number, number, number, 51, number, number] // wide hold end
	)[];
}

export type { Cbt };

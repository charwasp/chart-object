/**
 * See [format specification](../documents/format-specification.md#cbt-format) for details.
 */
interface Cbt {
    info: {
        bpm: number;
        dir: string;
        delay: number;
    };
    notes: ([number, number, number, number, number, 1, string] | [number, number, number, number, number, 2, number] | [number, number, number, number, number, 3, number] | [number, number, number, number, number, 10] | [number, number, number, number, number, 20, number] | [number, number, number, number, number, 21, number] | [number, number, number, number, number, 22, number] | [number, number, number, number, number, 30, number] | [number, number, number, number, number, 31, number] | [number, number, number, number, number, 32, number] | [number, number, number, number, number, 40, number] | [number, number, number, number, number, 50, number, number] | [number, number, number, number, number, 51, number, number])[];
}
export type { Cbt };

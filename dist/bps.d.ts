import { Fraction } from "fraction.js";
declare class BpsChange {
    beat: Fraction;
    bps: number;
    constructor(beat: Fraction, bps: number);
    /**
     * Calculates the BPM from the BPS.
     *
     * @returns The BPM.
     */
    bpm(): number;
    /**
     * Compares two BPS changes by their {@link beat} property.
     */
    static compare(a: BpsChange, b: BpsChange): number;
}
declare class BpsList {
    initialBps: number;
    bpsChanges: BpsChange[];
    constructor(initialBps?: number);
    addBpsChange(beat: Fraction, bps: number): void;
    addBpmChange(beat: Fraction, bpm: number): void;
    initialBpm(): number;
    bpsAt(beat: Fraction): number;
    timeAt(beat: Fraction): number;
    bpmAt(beat: Fraction): number;
    deduplicate(): void;
    encodedLength(): number;
    encode(output: DataView, offset: number): number;
    static decode(input: DataView, offset: number): BpsList;
    copyFrom(other: BpsList): void;
}
export { BpsChange, BpsList };

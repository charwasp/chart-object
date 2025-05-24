import { Fraction } from "fraction.js";
import { BpsList } from "./bps.js";
declare class SpeedChange {
    beat: Fraction;
    speed: number;
    constructor(beat: Fraction, speed: number);
    /**
     * Compares two speed changes by their {@link beat} property.
     */
    static compare(a: SpeedChange, b: SpeedChange): number;
}
declare class SpeedList {
    initialSpeed: number;
    speedChanges: SpeedChange[];
    constructor(initialSpeed?: number);
    addSpeedChange(beat: Fraction, bps: number): void;
    /**
     * Binary searches the {@link speedChanges} to find the speed at the given beat.
     *
     * @param beat The beat at which to find the speed.
     * @returns The speed at the given beat.
     */
    speedAt(beat: Fraction): number;
    /**
     * Assuming that a 1D particle moves at velocity specified piecewisely by the speed list,
     * this function returns the position of the particle at the given time.
     *
     * @param time The time at which to find the position.
     * @param bpsList The BPS list to use for getting the time of each speed change.
     *
     * @see {@link Chart.yAt}
     */
    yAt(time: number, bpsList: BpsList): number;
    deduplicate(): void;
    encodedLength(): number;
    encode(output: DataView, offset: number): number;
    static decode(input: DataView, offset: number): SpeedList;
    copyFrom(other: SpeedList): void;
}
export { SpeedChange, SpeedList };

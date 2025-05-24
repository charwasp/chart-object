import { Fraction } from "fraction.js"

import { BpsList } from "./bps.js";

class SpeedChange {
	beat: Fraction;
	speed: number;

	constructor(beat: Fraction, speed: number) {
		this.beat = beat;
		this.speed = speed;
	}

	/**
	 * Compares two speed changes by their {@link beat} property.
	 */
	static compare(a: SpeedChange, b: SpeedChange): number {
		return a.beat.compare(b.beat);
	}
}

class SpeedList {
	initialSpeed: number;
	speedChanges: SpeedChange[];

	constructor(initialSpeed = 1) {
		this.initialSpeed = initialSpeed;
		this.speedChanges = [];
	}

	addSpeedChange(beat: Fraction, bps: number) {
		this.speedChanges.push(new SpeedChange(beat, bps));
		this.speedChanges.sort(SpeedChange.compare);
	}

	/**
	 * Binary searches the {@link speedChanges} to find the speed at the given beat.
	 * 
	 * @param beat The beat at which to find the speed.
	 * @returns The speed at the given beat.
	 */
	speedAt(beat: Fraction): number {
		let lower: number = -1;
		let upper: number = this.speedChanges.length;
		while (upper - lower > 1) {
			const mid = Math.floor((lower + upper) / 2);
			const midBeat = mid >= 0 ? this.speedChanges[mid].beat : new Fraction(0);
			if (midBeat.gt(beat)) {
				upper = mid;
			} else {
				lower = mid;
			}
		}
		return upper === 0 ? this.initialSpeed : this.speedChanges[lower].speed;
	}

	/**
	 * Assuming that a 1D particle moves at velocity specified piecewisely by the speed list,
	 * this function returns the position of the particle at the given time.
	 * 
	 * @param time The time at which to find the position.
	 * @param bpsList The BPS list to use for getting the time of each speed change.
	 * 
	 * @see {@link Chart.yAt}
	 */
	yAt(time: number, bpsList: BpsList): number {
		let result = 0;
		let currentTime = 0;
		let speed = this.initialSpeed;
		for (const { beat: newBeat, speed: newSpeed } of this.speedChanges) {
			const newTime = bpsList.timeAt(newBeat);
			if (newTime >= time) {
				break;
			}
			result += (newTime - currentTime) * speed;
			currentTime = newTime;
			speed = newSpeed;
		}
		return result + (time - currentTime) * speed;
	}

	deduplicate() {
		let current = this.initialSpeed;
		for (let i = 0; i < this.speedChanges.length;) {
			const speedChange = this.speedChanges[i];
			if (speedChange.speed === current) {
				this.speedChanges.splice(i, 1);
			} else {
				current = speedChange.speed;
				i++;
			}
		}
	}

	encodedLength(): number {
		return 4 + 8 + this.speedChanges.length * 16;
	}

	encode(output: DataView, offset: number): number {
		output.setUint32(offset, this.speedChanges.length, true);
		offset += 4;
		output.setFloat64(offset, this.initialSpeed, true);
		offset += 8;
		let lastBeat = new Fraction(0);
		for (const speedChange of this.speedChanges) {
			const deltaBeat = speedChange.beat.sub(lastBeat);
			output.setUint32(offset, Number(deltaBeat.n), true);
			offset += 4;
			output.setUint32(offset, Number(deltaBeat.d), true);
			offset += 4;
			output.setFloat64(offset, speedChange.speed, true);
			offset += 8;
			lastBeat = speedChange.beat;
		}
		return offset;
	}

	static decode(input: DataView, offset: number): SpeedList {
		const speedList = new SpeedList();
		const bpsChangeCount = input.getUint32(offset, true);
		offset += 4;
		speedList.initialSpeed = input.getFloat64(offset, true);
		offset += 8;
		let lastBeat = new Fraction(0);
		for (let i = 0; i < bpsChangeCount; i++) {
			const deltaBeatN = input.getUint32(offset, true);
			offset += 4;
			const deltaBeatD = input.getUint32(offset, true);
			offset += 4;
			const deltaBeat = new Fraction(deltaBeatN, deltaBeatD);
			const bps = input.getFloat64(offset, true);
			offset += 8;
			const beat = lastBeat.add(deltaBeat);
			speedList.speedChanges.push(new SpeedChange(beat, bps));
			lastBeat = beat;
		}
		speedList.speedChanges.sort(SpeedChange.compare);
		return speedList;
	}

	copyFrom(other: SpeedList) {
		this.initialSpeed = other.initialSpeed;
		this.speedChanges.length = 0;
		for (const speedChange of other.speedChanges) {
			this.speedChanges.push(new SpeedChange(speedChange.beat.clone(), speedChange.speed));
		}
	}
}

export { SpeedChange, SpeedList };

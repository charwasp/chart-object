import { Fraction } from "fraction.js"

class BpsChange {
	beat: Fraction;
	bps: number;

	constructor(beat: Fraction, bps: number) {
		this.beat = beat;
		this.bps = bps;
	}

	/**
	 * Calculates the BPM from the BPS.
	 * 
	 * @returns The BPM.
	 */
	bpm(): number {
		return 60 * this.bps;
	}

	/**
	 * Compares two BPS changes by their {@link beat} property.
	 */
	static compare(a: BpsChange, b: BpsChange): number {
		return a.beat.compare(b.beat);
	}
}

class BpsList {
	initialBps: number;
	bpsChanges: BpsChange[];

	constructor(initialBps = 2) {
		this.initialBps = initialBps;
		this.bpsChanges = [];
	}

	addBpsChange(beat: Fraction, bps: number) {
		this.bpsChanges.push(new BpsChange(beat, bps));
		this.bpsChanges.sort(BpsChange.compare);
	}

	addBpmChange(beat: Fraction, bpm: number) {
		this.addBpsChange(beat, bpm / 60);
	}

	initialBpm(): number {
		return this.initialBps * 60;
	}

	bpsAt(beat: Fraction): number {
		let lower: number = -1;
		let upper: number = this.bpsChanges.length;
		while (upper - lower > 1) {
			const mid = Math.floor((lower + upper) / 2);
			const midBeat = mid >= 0 ? this.bpsChanges[mid].beat : new Fraction(0);
			if (midBeat.gt(beat)) {
				upper = mid;
			} else {
				lower = mid;
			}
		}
		return upper === 0 ? this.initialBps : this.bpsChanges[lower].bps;
	}

	timeAt(beat: Fraction): number {
		let result = 0;
		let currentBeat = new Fraction(0);
		let bps = this.initialBps;
		for (const { beat: newBeat, bps: newBps } of this.bpsChanges) {
			if (newBeat.gte(beat)) {
				break;
			}
			result += newBeat.sub(currentBeat).valueOf() / bps;
			currentBeat = newBeat;
			bps = newBps;
		}
		return result + beat.sub(currentBeat).valueOf() / bps;
	}

	bpmAt(beat: Fraction): number {
		return this.bpsAt(beat) * 60;
	}

	deduplicate() {
		let current = this.initialBps;
		for (let i = 0; i < this.bpsChanges.length;) {
			const bpsChange = this.bpsChanges[i];
			if (bpsChange.bps === current) {
				this.bpsChanges.splice(i, 1);
			} else {
				current = bpsChange.bps;
				i++;
			}
		}
	}

	encodedLength(): number {
		return 4 + 8 + this.bpsChanges.length * 16;
	}

	encode(output: DataView, offset: number): number {
		output.setUint32(offset, this.bpsChanges.length, true);
		offset += 4;
		output.setFloat64(offset, this.initialBps, true);
		offset += 8;
		let lastBeat = new Fraction(0);
		for (const bpsChange of this.bpsChanges) {
			const deltaBeat = bpsChange.beat.sub(lastBeat);
			output.setUint32(offset, Number(deltaBeat.n), true);
			offset += 4;
			output.setUint32(offset, Number(deltaBeat.d), true);
			offset += 4;
			output.setFloat64(offset, bpsChange.bps, true);
			offset += 8;
			lastBeat = bpsChange.beat;
		}
		return offset;
	}

	static decode(input: DataView, offset: number): BpsList {
		const bpsList = new BpsList();
		const bpsChangeCount = input.getUint32(offset, true);
		offset += 4;
		bpsList.initialBps = input.getFloat64(offset, true);
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
			bpsList.bpsChanges.push(new BpsChange(beat, bps));
			lastBeat = beat;
		}
		bpsList.bpsChanges.sort(BpsChange.compare);
		return bpsList;
	}

	copyFrom(other: BpsList) {
		this.initialBps = other.initialBps;
		this.bpsChanges.length = 0;
		for (const bpsChange of other.bpsChanges) {
			this.bpsChanges.push(new BpsChange(bpsChange.beat.clone(), bpsChange.bps));
		}
	}
}

export { BpsChange, BpsList };

import { Fraction } from 'fraction.js';
import { getFloat16, setFloat16 } from '@petamoriken/float16';

class Note {
	beat: Fraction;
	trackCount: number;
	trackIndex: number;
	width: number = 0;

	constructor(beat: Fraction, trackCount: number, trackIndex: number) {
		this.beat = beat;
		this.trackCount = trackCount;
		this.trackIndex = trackIndex;
	}

	/**
	 * Compares two notes by their {@link beat} property.
	 */
	static compare(a: Note, b: Note): number {
		return a.beat.compare(b.beat);
	}

	/**
	 * The horizontal position of the note in the range [0, 1].
	 * 
	 * @returns The horizontal position of the note.
	 */
	x(): number {
		return (this.trackIndex + 0.5) / this.trackCount;
	}

	/**
	 * If {@link width} is not zero, then the note is a wide note.
	 * This method returns whether the note is a wide note.
	 * 
	 * @returns Whether this is a wide note.
	 */
	isWide(): boolean {
		return this.width !== 0;
	}
}

class Tap extends Note {
}

/**
 * A note that can be grouped with other notes of the same type.
 * Child classes are {@link Hold} and {@link Drag}.
 * 
 * @template T For {@link Hold}, this is {@link Hold}. For {@link Drag}, this is {@link Drag}.
 * This type parameter is used to ensure that {@link peers} can only contain the same type of groupable notes.
 */
class GroupableNote<T extends GroupableNote<T>> extends Note {
	/**
	 * The group of notes that this note belongs to.
	 * The `peers` property of every note in the group must be the same reference.
	 */
	peers: T[] = [this.self()];

	/**
	 * Just to work around TypeScript's type system.
	 * @returns `this`.
	 */
	protected self(): T {
		return this as unknown as T;
	}

	/**
	 * @returns Whether this note is the first note in the group.
	 */
	isBegin() {
		return this.self() === this.peers[0];
	}

	/**
	 * @returns Whether this note is the last note in the group.
	 */
	isEnd() {
		return this.self() === this.peers[this.peers.length - 1];
	}

	/**
	 * @returns Whether this note is neither the first nor the last note in the group.
	 */
	isMiddle() {
		return !this.isBegin() && !this.isEnd();
	}

	/**
	 * @returns Whether this note is the only note in the group.
	 */
	isIsolated() {
		return this.peers.length === 1;
	}

	/**
	 * Merges different groupable notes of the same type into one group.
	 * 
	 * @param others The other groupable notes to merge with.
	 * 
	 * @example
	 * ```ts
	 * const note1 = new Hold(new Fraction(0), 4, 0);
	 * const note2 = new Hold(new Fraction(1), 4, 1);
	 * note1.mergeWith(note2);
	 * console.log(note1.peers[0] === note1); // true
	 * console.log(note1.peers[1] === note2); // true
	 * ```
	 */
	mergeWith(...others: T[]) {
		const concatenated = new Set<T[]>();
		for (const { peers: otherPeers } of others) {
			if (concatenated.has(otherPeers)) {
				continue;
			}
			this.peers.push(...otherPeers);
			concatenated.add(otherPeers);
		}
		this.peers.forEach(note => note.peers = this.peers);
		this.peers.sort(Note.compare);
	}
}

class Hold extends GroupableNote<Hold> {
}

class Drag extends GroupableNote<Drag> {
}

class NoteList {
	notes: Note[] = [];

	addNote(note: Note) {
		this.notes.push(note);
		this.notes.sort(Note.compare);
	}

	encodedLength(): number {
		return 4 + this.notes.length * (4 + 4 + 2 + 2 + 4 + 2);
	}

	encode(output: DataView, offset: number): number {
		const nexts = new WeakMap<Note, number>();
		const indices = new WeakMap<Note, number>();
		this.notes.forEach((note, index) => indices.set(note, index));
		this.notes.forEach(note => {
			if (!nexts.has(note) && note instanceof GroupableNote) {
				const peers = (note as Hold | Drag).peers;
				for (let i = 0; i < peers.length - 1; i++) {
					nexts.set(peers[i], indices.get(peers[i+1]) - indices.get(peers[i]));
				}
			}
		});
		output.setUint32(offset, this.notes.length, true);
		offset += 4;
		let beat = new Fraction(0);
		for (let note of this.notes) {
			const deltaBeat = note.beat.sub(beat);
			output.setUint32(offset, Number(deltaBeat.n), true);
			offset += 4;
			output.setUint32(offset, Number(deltaBeat.d), true);
			offset += 4;
			output.setUint16(offset, note.trackCount, true);
			offset += 2;
			output.setUint16(offset, note.trackIndex, true);
			offset += 2;
			output.setUint32(offset, nexts.get(note), true);
			offset += 4;
			setFloat16(output, offset, note instanceof Drag ? -note.width : note.width, true);
			offset += 2;
			beat = note.beat;
		}
		return offset;
	}

	static decode(input: DataView, offset: number): NoteList {
		const noteList = new NoteList();
		const count = input.getUint32(offset, true);
		offset += 4;
		const prevs = new Map<number, Note>();
		let beat = new Fraction(0);
		for (let i = 0; i < count; i++) {
			const deltaBeatN = input.getUint32(offset, true);
			offset += 4;
			const deltaBeatD = input.getUint32(offset, true);
			offset += 4;
			const trackCount = input.getUint16(offset, true);
			offset += 2;
			const trackIndex = input.getUint16(offset, true);
			offset += 2;
			const next = input.getUint32(offset, true);
			offset += 4;
			const width = getFloat16(input, offset, true);
			offset += 2;
			beat = beat.add(new Fraction(deltaBeatN, deltaBeatD));
			let note: Note;
			if (1/width < 0) {
				note = new Drag(beat, trackCount, trackIndex);
				note.width = -width;
				if (prevs.has(i)) {
					const peers = (prevs.get(i) as Drag).peers;
					peers.push(note as Drag);
					(note as Drag).peers = peers;
				}
			} else if (prevs.has(i) || next) {
				note = new Hold(beat, trackCount, trackIndex);
				note.width = width;
				if (prevs.has(i)) {
					const peers = (prevs.get(i) as Hold).peers;
					peers.push(note as Hold);
					(note as Hold).peers = peers;
				}
			} else {
				note = new Tap(beat, trackCount, trackIndex);
				note.width = width;
			}
			if (next) {
				prevs.set(i + next, note);
			}
			noteList.notes.push(note);
		}
		return noteList;
	}
}

export { Note, Tap, Hold, Drag, NoteList, GroupableNote };

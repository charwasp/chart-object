import { Fraction } from 'fraction.js';
declare class Note {
    beat: Fraction;
    trackCount: number;
    trackIndex: number;
    width: number;
    constructor(beat: Fraction, trackCount: number, trackIndex: number);
    /**
     * Compares two notes by their {@link beat} property.
     */
    static compare(a: Note, b: Note): number;
    /**
     * The horizontal position of the note in the range [0, 1].
     *
     * @returns The horizontal position of the note.
     */
    x(): number;
    /**
     * If {@link width} is not zero, then the note is a wide note.
     * This method returns whether the note is a wide note.
     *
     * @returns Whether this is a wide note.
     */
    isWide(): boolean;
}
declare class Tap extends Note {
}
/**
 * A note that can be grouped with other notes of the same type.
 * Child classes are {@link Hold} and {@link Drag}.
 *
 * @template T For {@link Hold}, this is {@link Hold}. For {@link Drag}, this is {@link Drag}.
 * This type parameter is used to ensure that {@link peers} can only contain the same type of groupable notes.
 */
declare class GroupableNote<T extends GroupableNote<T>> extends Note {
    /**
     * The group of notes that this note belongs to.
     * The `peers` property of every note in the group must be the same reference.
     */
    peers: T[];
    /**
     * Just to work around TypeScript's type system.
     * @returns `this`.
     */
    protected self(): T;
    /**
     * @returns Whether this note is the first note in the group.
     */
    isBegin(): boolean;
    /**
     * @returns Whether this note is the last note in the group.
     */
    isEnd(): boolean;
    /**
     * @returns Whether this note is neither the first nor the last note in the group.
     */
    isMiddle(): boolean;
    /**
     * @returns Whether this note is the only note in the group.
     */
    isIsolated(): boolean;
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
    mergeWith(...others: T[]): void;
}
declare class Hold extends GroupableNote<Hold> {
}
declare class Drag extends GroupableNote<Drag> {
}
declare class NoteList {
    notes: Note[];
    addNote(note: Note): void;
    encodedLength(): number;
    encode(output: DataView, offset: number): number;
    static decode(input: DataView, offset: number): NoteList;
}
export { Note, Tap, Hold, Drag, NoteList, GroupableNote };

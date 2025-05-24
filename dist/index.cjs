'use strict';

var fraction_js = require('fraction.js');
var float16 = require('@petamoriken/float16');
var oggVorbis = require('@wasm-audio-decoders/ogg-vorbis');
var pngjs = require('pngjs');

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
class BpsChange {
  constructor(beat, bps) {
    __publicField$5(this, "beat");
    __publicField$5(this, "bps");
    this.beat = beat;
    this.bps = bps;
  }
  /**
   * Calculates the BPM from the BPS.
   * 
   * @returns The BPM.
   */
  bpm() {
    return 60 * this.bps;
  }
  /**
   * Compares two BPS changes by their {@link beat} property.
   */
  static compare(a, b) {
    return a.beat.compare(b.beat);
  }
}
class BpsList {
  constructor(initialBps = 2) {
    __publicField$5(this, "initialBps");
    __publicField$5(this, "bpsChanges");
    this.initialBps = initialBps;
    this.bpsChanges = [];
  }
  addBpsChange(beat, bps) {
    this.bpsChanges.push(new BpsChange(beat, bps));
    this.bpsChanges.sort(BpsChange.compare);
  }
  addBpmChange(beat, bpm) {
    this.addBpsChange(beat, bpm / 60);
  }
  initialBpm() {
    return this.initialBps * 60;
  }
  bpsAt(beat) {
    let lower = -1;
    let upper = this.bpsChanges.length;
    while (upper - lower > 1) {
      const mid = Math.floor((lower + upper) / 2);
      const midBeat = mid >= 0 ? this.bpsChanges[mid].beat : new fraction_js.Fraction(0);
      if (midBeat.gt(beat)) {
        upper = mid;
      } else {
        lower = mid;
      }
    }
    return upper === 0 ? this.initialBps : this.bpsChanges[lower].bps;
  }
  timeAt(beat) {
    let result = 0;
    let currentBeat = new fraction_js.Fraction(0);
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
  bpmAt(beat) {
    return this.bpsAt(beat) * 60;
  }
  deduplicate() {
    let current = this.initialBps;
    for (let i = 0; i < this.bpsChanges.length; ) {
      const bpsChange = this.bpsChanges[i];
      if (bpsChange.bps === current) {
        this.bpsChanges.splice(i, 1);
      } else {
        current = bpsChange.bps;
        i++;
      }
    }
  }
  encodedLength() {
    return 4 + 8 + this.bpsChanges.length * 16;
  }
  encode(output, offset) {
    output.setUint32(offset, this.bpsChanges.length, true);
    offset += 4;
    output.setFloat64(offset, this.initialBps, true);
    offset += 8;
    let lastBeat = new fraction_js.Fraction(0);
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
  static decode(input, offset) {
    const bpsList = new BpsList();
    const bpsChangeCount = input.getUint32(offset, true);
    offset += 4;
    bpsList.initialBps = input.getFloat64(offset, true);
    offset += 8;
    let lastBeat = new fraction_js.Fraction(0);
    for (let i = 0; i < bpsChangeCount; i++) {
      const deltaBeatN = input.getUint32(offset, true);
      offset += 4;
      const deltaBeatD = input.getUint32(offset, true);
      offset += 4;
      const deltaBeat = new fraction_js.Fraction(deltaBeatN, deltaBeatD);
      const bps = input.getFloat64(offset, true);
      offset += 8;
      const beat = lastBeat.add(deltaBeat);
      bpsList.bpsChanges.push(new BpsChange(beat, bps));
      lastBeat = beat;
    }
    bpsList.bpsChanges.sort(BpsChange.compare);
    return bpsList;
  }
  copyFrom(other) {
    this.initialBps = other.initialBps;
    this.bpsChanges.length = 0;
    for (const bpsChange of other.bpsChanges) {
      this.bpsChanges.push(new BpsChange(bpsChange.beat.clone(), bpsChange.bps));
    }
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
class SpeedChange {
  constructor(beat, speed) {
    __publicField$4(this, "beat");
    __publicField$4(this, "speed");
    this.beat = beat;
    this.speed = speed;
  }
  /**
   * Compares two speed changes by their {@link beat} property.
   */
  static compare(a, b) {
    return a.beat.compare(b.beat);
  }
}
class SpeedList {
  constructor(initialSpeed = 1) {
    __publicField$4(this, "initialSpeed");
    __publicField$4(this, "speedChanges");
    this.initialSpeed = initialSpeed;
    this.speedChanges = [];
  }
  addSpeedChange(beat, bps) {
    this.speedChanges.push(new SpeedChange(beat, bps));
    this.speedChanges.sort(SpeedChange.compare);
  }
  /**
   * Binary searches the {@link speedChanges} to find the speed at the given beat.
   * 
   * @param beat The beat at which to find the speed.
   * @returns The speed at the given beat.
   */
  speedAt(beat) {
    let lower = -1;
    let upper = this.speedChanges.length;
    while (upper - lower > 1) {
      const mid = Math.floor((lower + upper) / 2);
      const midBeat = mid >= 0 ? this.speedChanges[mid].beat : new fraction_js.Fraction(0);
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
  yAt(time, bpsList) {
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
    for (let i = 0; i < this.speedChanges.length; ) {
      const speedChange = this.speedChanges[i];
      if (speedChange.speed === current) {
        this.speedChanges.splice(i, 1);
      } else {
        current = speedChange.speed;
        i++;
      }
    }
  }
  encodedLength() {
    return 4 + 8 + this.speedChanges.length * 16;
  }
  encode(output, offset) {
    output.setUint32(offset, this.speedChanges.length, true);
    offset += 4;
    output.setFloat64(offset, this.initialSpeed, true);
    offset += 8;
    let lastBeat = new fraction_js.Fraction(0);
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
  static decode(input, offset) {
    const speedList = new SpeedList();
    const bpsChangeCount = input.getUint32(offset, true);
    offset += 4;
    speedList.initialSpeed = input.getFloat64(offset, true);
    offset += 8;
    let lastBeat = new fraction_js.Fraction(0);
    for (let i = 0; i < bpsChangeCount; i++) {
      const deltaBeatN = input.getUint32(offset, true);
      offset += 4;
      const deltaBeatD = input.getUint32(offset, true);
      offset += 4;
      const deltaBeat = new fraction_js.Fraction(deltaBeatN, deltaBeatD);
      const bps = input.getFloat64(offset, true);
      offset += 8;
      const beat = lastBeat.add(deltaBeat);
      speedList.speedChanges.push(new SpeedChange(beat, bps));
      lastBeat = beat;
    }
    speedList.speedChanges.sort(SpeedChange.compare);
    return speedList;
  }
  copyFrom(other) {
    this.initialSpeed = other.initialSpeed;
    this.speedChanges.length = 0;
    for (const speedChange of other.speedChanges) {
      this.speedChanges.push(new SpeedChange(speedChange.beat.clone(), speedChange.speed));
    }
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
class Note {
  constructor(beat, trackCount, trackIndex) {
    __publicField$3(this, "beat");
    __publicField$3(this, "trackCount");
    __publicField$3(this, "trackIndex");
    __publicField$3(this, "width", 0);
    this.beat = beat;
    this.trackCount = trackCount;
    this.trackIndex = trackIndex;
  }
  /**
   * Compares two notes by their {@link beat} property.
   */
  static compare(a, b) {
    return a.beat.compare(b.beat);
  }
  /**
   * The horizontal position of the note in the range [0, 1].
   * 
   * @returns The horizontal position of the note.
   */
  x() {
    return (this.trackIndex + 0.5) / this.trackCount;
  }
  /**
   * If {@link width} is not zero, then the note is a wide note.
   * This method returns whether the note is a wide note.
   * 
   * @returns Whether this is a wide note.
   */
  isWide() {
    return this.width !== 0;
  }
}
class Tap extends Note {
}
class GroupableNote extends Note {
  constructor() {
    super(...arguments);
    /**
     * The group of notes that this note belongs to.
     * The `peers` property of every note in the group must be the same reference.
     */
    __publicField$3(this, "peers", [this.self()]);
  }
  /**
   * Just to work around TypeScript's type system.
   * @returns `this`.
   */
  self() {
    return this;
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
  mergeWith(...others) {
    const concatenated = /* @__PURE__ */ new Set();
    for (const { peers: otherPeers } of others) {
      if (concatenated.has(otherPeers)) {
        continue;
      }
      this.peers.push(...otherPeers);
      concatenated.add(otherPeers);
    }
    this.peers.forEach((note) => note.peers = this.peers);
    this.peers.sort(Note.compare);
  }
}
class Hold extends GroupableNote {
}
class Drag extends GroupableNote {
}
class NoteList {
  constructor() {
    __publicField$3(this, "notes", []);
  }
  addNote(note) {
    this.notes.push(note);
    this.notes.sort(Note.compare);
  }
  encodedLength() {
    return 4 + this.notes.length * (4 + 4 + 2 + 2 + 4 + 2);
  }
  encode(output, offset) {
    const nexts = /* @__PURE__ */ new WeakMap();
    const indices = /* @__PURE__ */ new WeakMap();
    this.notes.forEach((note, index) => indices.set(note, index));
    this.notes.forEach((note) => {
      if (!nexts.has(note) && note instanceof GroupableNote) {
        const peers = note.peers;
        for (let i = 0; i < peers.length - 1; i++) {
          nexts.set(peers[i], indices.get(peers[i + 1]) - indices.get(peers[i]));
        }
      }
    });
    output.setUint32(offset, this.notes.length, true);
    offset += 4;
    let beat = new fraction_js.Fraction(0);
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
      float16.setFloat16(output, offset, note instanceof Drag ? -note.width : note.width, true);
      offset += 2;
      beat = note.beat;
    }
    return offset;
  }
  static decode(input, offset) {
    const noteList = new NoteList();
    const count = input.getUint32(offset, true);
    offset += 4;
    const prevs = /* @__PURE__ */ new Map();
    let beat = new fraction_js.Fraction(0);
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
      const width = float16.getFloat16(input, offset, true);
      offset += 2;
      beat = beat.add(new fraction_js.Fraction(deltaBeatN, deltaBeatD));
      let note;
      if (1 / width < 0) {
        note = new Drag(beat, trackCount, trackIndex);
        note.width = -width;
        if (prevs.has(i)) {
          const peers = prevs.get(i).peers;
          peers.push(note);
          note.peers = peers;
        }
      } else if (prevs.has(i) || next) {
        note = new Hold(beat, trackCount, trackIndex);
        note.width = width;
        if (prevs.has(i)) {
          const peers = prevs.get(i).peers;
          peers.push(note);
          note.peers = peers;
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

function encodeString(string, output, offset) {
  for (const char of new TextEncoder().encode(string)) {
    output.setUint8(offset, char);
    offset++;
  }
  output.setUint8(offset, 0);
  offset++;
  return offset;
}
function decodeString(input, offset) {
  const bytes = [];
  while (true) {
    const byte = input.getUint8(offset);
    offset++;
    if (byte === 0) {
      break;
    }
    bytes.push(byte);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
function stringEncodedLength(string) {
  return new TextEncoder().encode(string).length + 1;
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
class EmbedRequest {
  constructor(arrayBuffer, requestedOffset) {
    this.arrayBuffer = arrayBuffer;
    this.requestedOffset = requestedOffset;
  }
  length() {
    return this.arrayBuffer.byteLength;
  }
  /**
   * Writes the data in {@link arrayBuffer} to `output`.
   * It will revisit a previous location in `output` specified by {@link requestedOffset}
   * to write down the offset and length information there.
   * 
   * @param output The output buffer to write to.
   * @param offset The offset in the output buffer to start writing at.
   */
  write(output, offset) {
    output.setBigUint64(this.requestedOffset, BigInt(offset), true);
    output.setBigUint64(this.requestedOffset + 8, BigInt(this.length()), true);
    const input = new DataView(this.arrayBuffer);
    for (let i = 0; i < this.length(); i++) {
      output.setUint8(offset, input.getUint8(i));
      offset++;
    }
    return offset;
  }
}
class Provider {
  /**
   * If {@link EmbedRequest} objects are created when {@link encode} is called,
   * the length returned by this method should include the lengths of those embedded files
   * in addition to the length returned by {@link encodedLength}.
   * 
   * @returns The total length of the encoded data.
   * 
   * @see {@link FileProvider.encodedLength}
   */
  totalEncodedLength() {
    return this.encodedLength();
  }
}
const _AudioProvider = class _AudioProvider extends Provider {
  /**
   * Uses [@wasm-audio-decoders/ogg-vorbis](https://www.npmjs.com/package/@wasm-audio-decoders/ogg-vorbis)
   * to decode audio data in Ogg Vorbis format.
   * 
   * See {@link audioBuffer} for how the parameter `context` is used.
   * 
   * @param arrayBuffer The array buffer containing the audio data in Ogg Vorbis format.
   * @param context The audio context to use for creating the audio buffer.
   * @returns The decoded audio buffer.
   */
  static async decodeAudio(arrayBuffer, context) {
    if (!_AudioProvider.decoder) {
      _AudioProvider.decoder = new oggVorbis.OggVorbisDecoder();
      await _AudioProvider.decoder.ready;
    } else {
      await _AudioProvider.decoder.reset();
    }
    const decoder = _AudioProvider.decoder;
    const { channelData, sampleRate } = await decoder.decodeFile(new Uint8Array(arrayBuffer));
    const numberOfChannels = channelData.length;
    const length = channelData[0].length;
    const result = context?.createBuffer(numberOfChannels, length, sampleRate) ?? new AudioBuffer({ numberOfChannels, length, sampleRate });
    for (let i = 0; i < numberOfChannels; i++) {
      result.copyToChannel(channelData[i], i);
    }
    return result;
  }
};
__publicField$2(_AudioProvider, "decoder");
let AudioProvider = _AudioProvider;
class MusicProvider extends AudioProvider {
  static decode(music, input, offset) {
    return new MusicFromFileProvider(FileProvider.decode(input, offset));
  }
}
class PreviewProvider extends AudioProvider {
  static decode(music, input, offset) {
    switch (input.getInt8(offset)) {
      case 0:
        return PreviewFromMusicProvider.decode(music, input, offset);
      default:
        return new PreviewFromFileProvider(FileProvider.decode(input, offset));
    }
  }
}
class CoverProvider extends Provider {
  static decode(music, input, offset) {
    switch (input.getInt8(offset)) {
      case 0:
        return new CoverEmptyProvider();
      default:
        return new CoverFromFileProvider(FileProvider.decode(input, offset));
    }
  }
}
class ChartProvider extends Provider {
  static decode(music, input, offset) {
    return new ChartFromFileEmbedded(FileEmbedded.decode(input, offset));
  }
}
class FileProvider {
  constructor() {
    __publicField$2(this, "compressed", false);
  }
  async arrayBuffer() {
    if (!this.compressed) {
      return await this.originalArrayBuffer();
    }
    return await new Response(
      new Blob([await this.originalArrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).arrayBuffer();
  }
  /**
   * In addition to {@link encodedLength}, this includes the length of data that will be written later
   * by {@link EmbedRequest.write}.
   */
  totalEncodedLength() {
    return this.encodedLength();
  }
  static decode(input, offset) {
    const type = input.getInt8(offset);
    switch (type) {
      case 1:
      case -1:
        return FileEmbedded.decode(input, offset);
      case 2:
      case -2:
        return FileFromUrl.decode(input, offset);
      case 3:
      case -3:
        return FileFromPath.decode(input, offset);
    }
  }
}
class MusicFromFileProvider extends MusicProvider {
  constructor(fileProvider) {
    super();
    this.fileProvider = fileProvider;
  }
  encodedLength() {
    return this.fileProvider.encodedLength();
  }
  totalEncodedLength() {
    return this.fileProvider.totalEncodedLength();
  }
  async audioBuffer(context) {
    return await AudioProvider.decodeAudio(await this.fileProvider.arrayBuffer(), context);
  }
  encode(output, offset) {
    return this.fileProvider.encode(output, offset);
  }
}
class PreviewFromFileProvider extends PreviewProvider {
  constructor(fileProvider) {
    super();
    this.fileProvider = fileProvider;
  }
  encodedLength() {
    return this.fileProvider.encodedLength();
  }
  totalEncodedLength() {
    return this.fileProvider.totalEncodedLength();
  }
  async audioBuffer(context) {
    return await AudioProvider.decodeAudio(await this.fileProvider.arrayBuffer(), context);
  }
  encode(output, offset) {
    return this.fileProvider.encode(output, offset);
  }
}
class PreviewFromMusicProvider extends PreviewProvider {
  constructor(musicProvider) {
    super();
    this.musicProvider = musicProvider;
    /**
     * The offset in the original music data to start copying from.
     * Measured in audio frames.
     */
    __publicField$2(this, "offset", 0);
    /**
     * The length of the preview.
     * Measured in audio frames.
     */
    __publicField$2(this, "length", 441e3);
    /**
     * The length of the linear fade-in effect. Set to zero to disable fade-in.
     * Measured in audio frames.
     */
    __publicField$2(this, "fadeInLength", 44100);
    /**
     * The length of the linear fade-out effect. Set to zero to disable fade-out.
     * Measured in audio frames.
     */
    __publicField$2(this, "fadeOutLength", 44100);
  }
  async audioBuffer(context) {
    const musicAudioBuffer = await this.musicProvider.audioBuffer(context);
    const { numberOfChannels, sampleRate } = musicAudioBuffer;
    const result = context?.createBuffer(numberOfChannels, this.length, sampleRate) ?? new AudioBuffer({ numberOfChannels, length: this.length, sampleRate });
    for (let i = 0; i < numberOfChannels; i++) {
      const source = musicAudioBuffer.getChannelData(i);
      const destination = result.getChannelData(i);
      for (let j = 0; j < this.length; j++) {
        const factor = Math.min((j + 1) / this.fadeInLength, (this.length - j) / this.fadeOutLength, 1);
        destination[j] = factor * source[j + this.offset];
      }
    }
    return result;
  }
  encodedLength() {
    return 25;
  }
  encode(output, offset) {
    output.setInt8(offset, 0);
    offset++;
    output.setBigUint64(offset, BigInt(this.offset), true);
    offset += 8;
    output.setBigUint64(offset, BigInt(this.length), true);
    offset += 8;
    output.setUint32(offset, this.fadeInLength, true);
    offset += 4;
    output.setUint32(offset, this.fadeOutLength, true);
    offset += 4;
    return [offset, []];
  }
  static decode(music, input, offset) {
    offset++;
    const result = new PreviewFromMusicProvider(music.musicProvider);
    result.offset = Number(input.getBigUint64(offset, true));
    offset += 8;
    result.length = Number(input.getBigUint64(offset, true));
    offset += 8;
    result.fadeInLength = input.getUint32(offset, true);
    offset += 4;
    result.fadeOutLength = input.getUint32(offset, true);
    offset += 4;
    return result;
  }
}
class CoverEmptyProvider extends CoverProvider {
  async imageData(context) {
    return context?.createImageData(1, 1) ?? new ImageData(1, 1);
  }
  encodedLength() {
    return 1;
  }
  encode(output, offset) {
    output.setInt8(offset, 0);
    offset++;
    return [offset, []];
  }
}
class CoverFromFileProvider extends CoverProvider {
  constructor(fileProvider) {
    super();
    this.fileProvider = fileProvider;
  }
  async imageData(context) {
    const buffer = await this.fileProvider.arrayBuffer();
    const png = await new Promise((resolve, reject) => new pngjs.PNG().parse(
      Buffer.from(buffer),
      // Buffer will be polyfilled; see rollup.config.js
      (error, data) => error ? reject(error) : resolve(data)
    ));
    const result = context?.createImageData(png.width, png.height) ?? new ImageData(png.width, png.height);
    result.data.set(png.data);
    return result;
  }
  encodedLength() {
    return this.fileProvider.encodedLength();
  }
  totalEncodedLength() {
    return this.fileProvider.totalEncodedLength();
  }
  encode(output, offset) {
    return this.fileProvider.encode(output, offset);
  }
}
class ChartFromFileEmbedded extends ChartProvider {
  constructor(fileEmbedded) {
    super();
    this.fileEmbedded = fileEmbedded;
  }
  async chart() {
    const buffer = await this.fileEmbedded.arrayBuffer();
    return Chart.decode(new DataView(buffer), 0);
  }
  encodedLength() {
    return this.fileEmbedded.encodedLength();
  }
  totalEncodedLength() {
    return this.fileEmbedded.totalEncodedLength();
  }
  encode(output, offset) {
    return this.fileEmbedded.encode(output, offset);
  }
}
class FileEmbedded extends FileProvider {
  /**
   * Creates an instance.
   * This will make {@link internalArrayBuffer} a copy of part of `original`.
   * If `original` is a `SharedArrayBuffer`, it will be converted to an `ArrayBuffer`.
   * 
   * @param original The original buffer to copy from.
   * @param offset The offset in the original buffer to start copying from.
   * @param length The length of the data to copy.
   */
  constructor(original = new ArrayBuffer(0), offset = 0, length = original.byteLength) {
    super();
    __publicField$2(this, "internalArrayBuffer");
    const source = new Uint8Array(original, offset, length);
    const destination = new Uint8Array(length);
    destination.set(source);
    this.internalArrayBuffer = destination.buffer;
  }
  async originalArrayBuffer() {
    return this.internalArrayBuffer;
  }
  /**
   * This changes {@link internalArrayBuffer}.
   * No matter what the value of {@link compressed} is, `arrayBuffer` needs to be uncompressed data.
   * This method does the compression if necessary before setting {@link internalArrayBuffer}.
   * 
   * @param arrayBuffer The new data to set.
   */
  async set(arrayBuffer) {
    if (!this.compressed) {
      this.internalArrayBuffer = arrayBuffer;
      return;
    }
    this.internalArrayBuffer = await new Response(
      new Blob([arrayBuffer]).stream().pipeThrough(new CompressionStream("gzip"))
    ).arrayBuffer();
  }
  encodedLength() {
    return 17;
  }
  totalEncodedLength() {
    return this.encodedLength() + this.internalArrayBuffer.byteLength;
  }
  encode(output, offset) {
    output.setInt8(offset, this.compressed ? -1 : 1);
    offset++;
    const embedRequest = new EmbedRequest(this.internalArrayBuffer, offset);
    offset += 16;
    return [offset, [embedRequest]];
  }
  static decode(input, offset) {
    const compressed = input.getInt8(offset) < 0;
    offset++;
    const embedOffset = Number(input.getBigUint64(offset, true));
    offset += 8;
    const embedLength = Number(input.getBigUint64(offset, true));
    offset += 8;
    const result = new FileEmbedded(input.buffer, embedOffset + input.byteOffset, embedLength);
    result.compressed = compressed;
    return result;
  }
}
class FileFromUrl extends FileProvider {
  constructor(url) {
    super();
    this.url = url;
  }
  async originalArrayBuffer() {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch music file: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }
  encodedLength() {
    return 1 + stringEncodedLength(this.url);
  }
  encode(output, offset) {
    output.setInt8(offset, this.compressed ? -2 : 2);
    offset++;
    offset = encodeString(this.url, output, offset);
    return [offset, []];
  }
  static decode(input, offset) {
    const compressed = input.getInt8(offset) < 0;
    offset++;
    const result = new FileFromUrl(decodeString(input, offset));
    result.compressed = compressed;
    return result;
  }
}
const _FileFromPath = class _FileFromPath extends FileProvider {
  constructor(path) {
    super();
    this.path = path;
  }
  async originalArrayBuffer() {
    const base = _FileFromPath.base;
    if (_FileFromPath.base === void 0) {
      throw new Error("Base URL not set for relative path");
    }
    if (base.startsWith("http://") || base.startsWith("https://") || base.startsWith("file://")) {
      const response = await fetch(`${base}/${this.path}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch music file: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }
    if (typeof window !== "undefined") {
      throw new Error("Relative paths are not supported in the browser");
    }
    return (await import('fs')).readFileSync(`${base}/${this.path}`).buffer;
  }
  encodedLength() {
    return 1 + stringEncodedLength(this.path);
  }
  encode(output, offset) {
    output.setInt8(offset, this.compressed ? -3 : 3);
    offset++;
    offset = encodeString(this.path, output, offset);
    return [offset, []];
  }
  static decode(input, offset) {
    const compressed = input.getInt8(offset) < 0;
    offset++;
    const result = new _FileFromPath(decodeString(input, offset));
    result.compressed = compressed;
    return result;
  }
};
__publicField$2(_FileFromPath, "base");
let FileFromPath = _FileFromPath;

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
class Chart {
  constructor(offset = 0, initialBps = 2, initialSpeed = 1) {
    /**
     * The chart author's name.
     */
    __publicField$1(this, "charter", "");
    /**
     * Any comments about the chart.
     */
    __publicField$1(this, "comments", "");
    /**
     * The offset of the chart in seconds.
     * This is the time in the music when the zeroth beat happens.
     */
    __publicField$1(this, "offset");
    __publicField$1(this, "bpsList");
    __publicField$1(this, "speedList");
    __publicField$1(this, "noteList");
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
  yAt(time) {
    return this.speedList.yAt(time, this.bpsList);
  }
  /**
   * Similar to {@link yAt}, but takes a beat instead of time as the parameter.
   * 
   * @param beat The beat at which to find the y coordinate.
   * @returns The y coordinate at the given beat.
   */
  yAtBeat(beat) {
    return this.yAt(this.bpsList.timeAt(beat));
  }
  encodedLength() {
    return 4 + 1 + new TextEncoder().encode(this.charter).length + 1 + new TextEncoder().encode(this.comments).length + 1 + 8 + this.bpsList.encodedLength() + this.speedList.encodedLength() + this.noteList.encodedLength();
  }
  encode(output, offset) {
    output.setUint32(offset, 1129338691, true);
    offset += 4;
    output.setUint8(offset, 1);
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
  static decode(input, offset) {
    const chart = new Chart();
    offset += 4;
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
  beatToCbt(beat, startingMeasure = 0, beatsPerMeasure = 4) {
    const beatsPerMeasureFraction = new fraction_js.Fraction(beatsPerMeasure);
    const measure = beat.div(beatsPerMeasureFraction).floor();
    const beatInMeasure = beat.sub(measure.mul(beatsPerMeasureFraction)).div(beatsPerMeasureFraction);
    return [measure.valueOf() - startingMeasure, Number(beatInMeasure.n), Number(beatInMeasure.d)];
  }
  toCbt(beatsPerMeasure = 4) {
    const info = {
      bpm: this.bpsList.initialBpm() * beatsPerMeasure / 4,
      delay: 0,
      dir: ""
    };
    const offsetBeat = new fraction_js.Fraction(-this.offset * this.bpsList.initialBps);
    const startingMeasure = Math.min(Math.floor(-this.offset * this.bpsList.initialBps / beatsPerMeasure), 0);
    const [measure, subdivision, subdivisionCount] = this.beatToCbt(offsetBeat, startingMeasure, beatsPerMeasure);
    const notes = [[measure, 8, subdivisionCount, 0, subdivision, 1, "bgm"]];
    for (const bpsChange of this.bpsList.bpsChanges) {
      const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(bpsChange.beat, startingMeasure, beatsPerMeasure);
      notes.push([measure2, 8, subdivisionCount2, 0, subdivision2, 2, bpsChange.bpm() * beatsPerMeasure / 4]);
    }
    if (this.speedList.initialSpeed !== 1) {
      notes.push([0, 8, 4, 0, 0, 3, this.speedList.initialSpeed]);
    }
    for (const speedChange of this.speedList.speedChanges) {
      const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(speedChange.beat, startingMeasure, beatsPerMeasure);
      notes.push([measure2, 8, subdivisionCount2, 0, subdivision2, 3, speedChange.speed]);
    }
    let group = 0;
    const groups = /* @__PURE__ */ new WeakMap();
    for (const note of this.noteList.notes) {
      const [measure2, subdivision2, subdivisionCount2] = this.beatToCbt(note.beat, startingMeasure, beatsPerMeasure);
      const basicArgs = [measure2, note.trackCount, subdivisionCount2, note.trackIndex, subdivision2];
      if (note instanceof Tap) {
        notes.push([...basicArgs, ...note.width > 0 ? [40, note.width] : [10]]);
        continue;
      }
      const n = note;
      if (!groups.has(n.peers)) {
        groups.set(n.peers, group++);
      }
      let type;
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
      } else {
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
    return { info, notes };
  }
  static fromCbt(cbt, beatsPerMeasure = 4) {
    const chart = new Chart();
    chart.bpsList.initialBps = cbt.info.bpm / 60 * 4 / beatsPerMeasure;
    let offsetBeat;
    const groups = /* @__PURE__ */ new Map();
    for (const [measure, trackCount, subdivisionCount, trackIndex, subdivision, type, ...args] of cbt.notes) {
      const beat = new fraction_js.Fraction(measure * beatsPerMeasure, 1).add(subdivision * beatsPerMeasure, subdivisionCount);
      let note;
      let group;
      switch (type) {
        case 1:
          offsetBeat = beat;
          break;
        case 2:
          chart.bpsList.addBpmChange(beat, args[0]);
          break;
        case 3:
          chart.speedList.addSpeedChange(beat, args[0]);
          break;
        case 10:
        case 40:
          note = new Tap(beat, trackCount, trackIndex);
          chart.noteList.addNote(note);
          if (type === 40) {
            note.width = args[0];
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
            note.width = args[1];
          }
          group = args[0];
          if (groups.has(group)) {
            note.mergeWith(groups.get(group));
          } else {
            groups.set(group, note);
          }
          break;
        case 30:
        case 31:
        case 32:
          note = new Drag(beat, trackCount, trackIndex);
          chart.noteList.addNote(note);
          group = args[0];
          if (groups.has(group)) {
            note.mergeWith(groups.get(group));
          } else {
            groups.set(group, note);
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
class ChartInfo {
  constructor() {
    /**
     * The name of the difficulty.
     * Usually one of `"EASY"`, `"NORMAL"`, `"HARD"`, `"EXTRA"`, `"EXTRA+"`, `"CHAOS"`, `"CHAOS+"`.
     */
    __publicField$1(this, "difficultyName", "EXTRA");
    /**
     * The text describing the difficulty level.
     * Usually the decimal representation of an integer from 1 to 13.
     */
    __publicField$1(this, "difficultyText", "10");
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
    __publicField$1(this, "difficultyColor", [233, 0, 173]);
    /**
     * A number that quantitatively describes the difficulty of this chart.
     * It should be 1000 times the actual difficulty level.
     * For example, if the difficulty level is 12.9, then this number should be 12900.
     */
    __publicField$1(this, "difficulty", 1e4);
    __publicField$1(this, "chartProvider");
    __publicField$1(this, "_chart");
  }
  /**
   * This loads the actual chart data by decoding them from {@link chartProvider}.
   * The decoding only happens once, and then the chart is cached
   * so that the promise from subsequent calls resolves immediately.
   * 
   * @returns Loaded chart.
   */
  async chart() {
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
  setChart(value) {
    this._chart = value;
    this.chartProvider = null;
  }
  encodedLength() {
    return stringEncodedLength(this.difficultyName) + stringEncodedLength(this.difficultyText) + 3 + 4 + (this.chartProvider?.encodedLength() ?? 16);
  }
  /**
   * @see {@link Provider.totalEncodedLength}
   * @see {@link FileProvider.totalEncodedLength}
   */
  totalEncodeLength() {
    return stringEncodedLength(this.difficultyName) + stringEncodedLength(this.difficultyText) + 3 + 4 + (this.chartProvider?.totalEncodedLength() ?? 17 + this._chart.encodedLength());
  }
  encode(output, offset, compressed = false) {
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
  static decode(input, offset) {
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
  constructor() {
    __publicField$1(this, "charts", /* @__PURE__ */ new Map());
  }
  newChart(difficultyName) {
    const chartInfo = new ChartInfo();
    chartInfo.difficultyName = difficultyName;
    chartInfo.setChart(new Chart());
    this.charts.set(difficultyName, chartInfo);
    return chartInfo;
  }
  getChartInfo(difficultyName) {
    return this.charts.get(difficultyName);
  }
  encodedLength() {
    let length = 1;
    for (const chartInfo of this.charts.values()) {
      length += chartInfo.encodedLength();
    }
    return length;
  }
  totalEncodedLength() {
    let length = 1;
    for (const chartInfo of this.charts.values()) {
      length += chartInfo.totalEncodeLength();
    }
    return length;
  }
  encode(output, offset) {
    const embedRequests = [];
    output.setUint8(offset, this.charts.size);
    offset++;
    let newEmbedRequests;
    for (const chartInfo of this.charts.values()) {
      [offset, newEmbedRequests] = chartInfo.encode(output, offset);
      embedRequests.push(...newEmbedRequests);
    }
    return [offset, embedRequests];
  }
  static decode(input, offset) {
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

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class Music {
  constructor(musicProvider, previewProvider, coverProvider) {
    this.musicProvider = musicProvider;
    this.previewProvider = previewProvider;
    this.coverProvider = coverProvider;
    /**
     * The name of the music.
     */
    __publicField(this, "name", "");
    /**
     * The artist of the music.
     */
    __publicField(this, "artist", "");
    /**
     * The categories of the music represented as a bitmask.
     * All possible flags are:
     * 
     * | Flag | Meaning |
     * |-|-|
     * | `2` | |
     * | `4` | {@link instrumental} |
     * | `8` | {@link vocal} |
     * | `16` | |
     */
    __publicField(this, "categories", 0);
    /**
     * Keywords that intend to assist searching.
     */
    __publicField(this, "keywords", []);
    __publicField(this, "chartList", new ChartList());
  }
  /**
   * Implemented as reading the bitmask in {@link categories}.
   */
  get instrumental() {
    return !!(this.categories & 4);
  }
  /**
   * Implemented as writing the bitmask in {@link categories}.
   */
  set instrumental(value) {
    if (value) {
      this.categories |= 4;
    } else {
      this.categories &= -5;
    }
  }
  /**
   * Implemented as reading the bitmask in {@link categories}.
   */
  get vocal() {
    return !!(this.categories & 8);
  }
  /**
   * Implemented as writing the bitmask in {@link categories}.
   */
  set vocal(value) {
    if (value) {
      this.categories |= 8;
    } else {
      this.categories &= -9;
    }
  }
  newChart(difficultyName) {
    return this.chartList.newChart(difficultyName);
  }
  getChartInfo(difficultyName) {
    return this.chartList.getChartInfo(difficultyName);
  }
  chartCount() {
    return this.chartList.charts.size;
  }
  encodedLength() {
    return 4 + 1 + stringEncodedLength(this.name) + stringEncodedLength(this.artist) + 1 + this.musicProvider.totalEncodedLength() + this.previewProvider.totalEncodedLength() + this.coverProvider.totalEncodedLength() + 1 + this.keywords.reduce((sum, keyword) => sum + stringEncodedLength(keyword), 0) + this.chartList.totalEncodedLength();
  }
  encode(output, offset) {
    const embedRequests = [];
    output.setUint32(offset, 1297110851, true);
    offset += 4;
    output.setUint8(offset, 1);
    offset++;
    offset = encodeString(this.name, output, offset);
    offset = encodeString(this.artist, output, offset);
    output.setUint8(offset, this.categories);
    offset++;
    let newEmbedRequests;
    [offset, newEmbedRequests] = this.musicProvider.encode(output, offset);
    embedRequests.push(...newEmbedRequests);
    [offset, newEmbedRequests] = this.previewProvider.encode(output, offset);
    embedRequests.push(...newEmbedRequests);
    [offset, newEmbedRequests] = this.coverProvider.encode(output, offset);
    embedRequests.push(...newEmbedRequests);
    output.setUint8(offset, this.keywords.length);
    offset++;
    for (const keyword of this.keywords) {
      offset = encodeString(keyword, output, offset);
    }
    [offset, newEmbedRequests] = this.chartList.encode(output, offset);
    embedRequests.push(...newEmbedRequests);
    for (const embedRequest of embedRequests) {
      offset = embedRequest.write(output, offset);
    }
    return offset;
  }
  static decode(input, offset) {
    const music = new Music(null, null, null);
    offset += 4;
    if (input.getUint8(offset) !== 1) {
      throw new Error("Unsupported version");
    }
    offset++;
    music.name = decodeString(input, offset);
    offset += stringEncodedLength(music.name);
    music.artist = decodeString(input, offset);
    offset += stringEncodedLength(music.artist);
    music.categories = input.getUint8(offset);
    offset++;
    music.musicProvider = MusicProvider.decode(music, input, offset);
    offset += music.musicProvider.encodedLength();
    music.previewProvider = PreviewProvider.decode(music, input, offset);
    offset += music.previewProvider.encodedLength();
    music.coverProvider = CoverProvider.decode(music, input, offset);
    offset += music.coverProvider.encodedLength();
    const keywordCount = input.getUint8(offset);
    offset++;
    music.keywords = [];
    for (let i = 0; i < keywordCount; i++) {
      const keyword = decodeString(input, offset);
      offset += stringEncodedLength(keyword);
      music.keywords.push(keyword);
    }
    music.chartList = ChartList.decode(input, offset);
    return music;
  }
}

exports.BpsChange = BpsChange;
exports.BpsList = BpsList;
exports.Chart = Chart;
exports.ChartFromFileEmbedded = ChartFromFileEmbedded;
exports.ChartInfo = ChartInfo;
exports.ChartList = ChartList;
exports.ChartProvider = ChartProvider;
exports.CoverEmptyProvider = CoverEmptyProvider;
exports.CoverFromFileProvider = CoverFromFileProvider;
exports.CoverProvider = CoverProvider;
exports.Drag = Drag;
exports.EmbedRequest = EmbedRequest;
exports.FileEmbedded = FileEmbedded;
exports.FileFromPath = FileFromPath;
exports.FileFromUrl = FileFromUrl;
exports.FileProvider = FileProvider;
exports.GroupableNote = GroupableNote;
exports.Hold = Hold;
exports.Music = Music;
exports.MusicFromFileProvider = MusicFromFileProvider;
exports.MusicProvider = MusicProvider;
exports.Note = Note;
exports.NoteList = NoteList;
exports.PreviewFromFileProvider = PreviewFromFileProvider;
exports.PreviewFromMusicProvider = PreviewFromMusicProvider;
exports.PreviewProvider = PreviewProvider;
exports.Provider = Provider;
exports.SpeedChange = SpeedChange;
exports.SpeedList = SpeedList;
exports.Tap = Tap;
//# sourceMappingURL=index.cjs.map

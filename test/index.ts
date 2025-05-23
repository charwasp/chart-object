import { Fraction } from 'fraction.js';
import AudioBuffer from 'audio-buffer';

import { Chart, Tap, Hold, Drag, MusicFromFileProvider, FileEmbedded, PreviewFromMusicProvider, CoverEmptyProvider, Music } from '../src/index.js';
import type { Cbt } from '../src/cbt.js';
import { test, expect } from './helper.js';

globalThis.AudioBuffer = AudioBuffer as any;

test('BpsList bpsAt', () => {
	const bpsList = new Chart(0, 2, 1).bpsList;
	bpsList.addBpsChange(new Fraction(1, 1), 4);
	bpsList.addBpsChange(new Fraction(2, 1), 8);

	expect(bpsList.bpsAt(new Fraction(0, 1))).toBe(2);
	expect(bpsList.bpsAt(new Fraction(1, 1))).toBe(4);
	expect(bpsList.bpsAt(new Fraction(2, 1))).toBe(8);
	expect(bpsList.bpsAt(new Fraction(3, 1))).toBe(8);
	expect(bpsList.bpsAt(new Fraction(1, 2))).toBe(2);
	expect(bpsList.bpsAt(new Fraction(3, 2))).toBe(4);
});

test('SpeedList yAt', () => {
	const chart = new Chart(0, 1, 1);
	const speedList = chart.speedList;
	speedList.addSpeedChange(new Fraction(1, 1), 2);
	speedList.addSpeedChange(new Fraction(2, 1), 0.5);

	expect(chart.yAtBeat(new Fraction(0, 1))).toBeApproximately(0);
	expect(chart.yAtBeat(new Fraction(1, 2))).toBeApproximately(0.5);
	expect(chart.yAtBeat(new Fraction(1, 1))).toBeApproximately(1);
	expect(chart.yAtBeat(new Fraction(3, 2))).toBeApproximately(2);
	expect(chart.yAtBeat(new Fraction(2, 1))).toBeApproximately(3);
	expect(chart.yAtBeat(new Fraction(5, 2))).toBeApproximately(3.25);
	expect(chart.yAtBeat(new Fraction(3, 1))).toBeApproximately(3.5);
	expect(chart.yAtBeat(new Fraction(4, 1))).toBeApproximately(4);
});

test('BpsList encode, decode', () => {
	const chart = new Chart(0, 2, 1);
	const bpsList = chart.bpsList;
	chart.bpsList.addBpsChange(new Fraction(1, 1), 4);
	chart.bpsList.addBpsChange(new Fraction(1, 2), 8);
	const buffer = new ArrayBuffer(chart.encodedLength());
	const output = new DataView(buffer);
	chart.encode(output, 0);
	const bpsList2 = Chart.decode(output, 0).bpsList;

	expect(bpsList2.initialBps).toBe(bpsList.initialBps);
	expect(bpsList2.bpsChanges.length).toBe(bpsList.bpsChanges.length);
	for (let i = 0; i < bpsList.bpsChanges.length; i++) {
		expect(bpsList2.bpsChanges[i].beat.n).toBe(bpsList.bpsChanges[i].beat.n);
		expect(bpsList2.bpsChanges[i].beat.d).toBe(bpsList.bpsChanges[i].beat.d);
		expect(bpsList2.bpsChanges[i].bps).toBe(bpsList.bpsChanges[i].bps);
	}
});

test('SpeedList encode, decode', () => {
	const chart = new Chart(0, 2, 1);
	const speedList = chart.speedList;
	chart.speedList.addSpeedChange(new Fraction(1, 1), 4);
	chart.speedList.addSpeedChange(new Fraction(1, 2), 8);
	const buffer = new ArrayBuffer(chart.encodedLength());
	const output = new DataView(buffer);
	chart.encode(output, 0);
	const speedList2 = Chart.decode(output, 0).speedList;

	expect(speedList2.initialSpeed).toBe(speedList.initialSpeed);
	expect(speedList2.speedChanges.length).toBe(speedList.speedChanges.length);
	for (let i = 0; i < speedList.speedChanges.length; i++) {
		expect(speedList2.speedChanges[i].beat.n).toBe(speedList.speedChanges[i].beat.n);
		expect(speedList2.speedChanges[i].beat.d).toBe(speedList.speedChanges[i].beat.d);
		expect(speedList2.speedChanges[i].speed).toBe(speedList.speedChanges[i].speed);
	}
});

test('NoteList encode, decode', () => {
	const chart = new Chart(0, 2, 1);
	const noteList = chart.noteList;
	noteList.addNote(new Tap(new Fraction(1, 1), 4, 0));
	const holdStart = new Hold(new Fraction(1, 2), 5, 4);
	noteList.addNote(holdStart);
	const holdEnd = new Hold(new Fraction(3, 2), 5, 3);
	noteList.addNote(holdEnd);
	holdStart.mergeWith(holdEnd);
	const dragStart = new Drag(new Fraction(2, 1), 5, 2);
	noteList.addNote(dragStart);
	const dragEnd = new Drag(new Fraction(3, 1), 5, 1);
	noteList.addNote(dragEnd);
	dragStart.mergeWith(dragEnd);
	const buffer = new ArrayBuffer(chart.encodedLength());
	const output = new DataView(buffer);
	chart.encode(output, 0);
	const noteList2 = Chart.decode(output, 0).noteList;

	expect(noteList2.notes.length).toBe(chart.noteList.notes.length);
	for (let i = 0; i < chart.noteList.notes.length; i++) {
		expect(noteList2.notes[i].constructor).toBe(chart.noteList.notes[i].constructor);
		expect(noteList2.notes[i].beat.n).toBe(noteList.notes[i].beat.n);
		expect(noteList2.notes[i].beat.d).toBe(noteList.notes[i].beat.d);
		expect(noteList2.notes[i].trackCount).toBe(noteList.notes[i].trackCount);
		expect(noteList2.notes[i].trackIndex).toBe(noteList.notes[i].trackIndex);
	}
});

test('Chart toCbt', () => {
	const chart = new Chart(0.5, 1, 1);
	chart.noteList.addNote(new Tap(new Fraction(1, 1), 4, 0));
	const holdStart = new Hold(new Fraction(1, 2), 5, 4);
	chart.noteList.addNote(holdStart);
	const holdEnd = new Hold(new Fraction(3, 2), 5, 3);
	chart.noteList.addNote(holdEnd);
	holdStart.mergeWith(holdEnd);
	const dragStart = new Drag(new Fraction(2, 1), 5, 2);
	chart.noteList.addNote(dragStart);
	const dragEnd = new Drag(new Fraction(3, 1), 5, 1);
	chart.noteList.addNote(dragEnd);
	dragStart.mergeWith(dragEnd);
	const cbtNotes = chart.toCbt().notes;

	expect(cbtNotes.length).toBe(6);
	let [measure, _, subdivisionCount, __, subdivision] = cbtNotes.find(note => note[5] === 1) as number[];
	expect(measure).toBe(0);
	expect(subdivision / subdivisionCount).toBeApproximately(3.5/4);
	[measure, _, subdivisionCount, __, subdivision] = cbtNotes.find(note => note[5] === 10) as number[];
	expect(measure).toBe(1);
	expect(subdivision / subdivisionCount).toBeApproximately(1/4);
	const holdBeginGroup = (cbtNotes.find(note => note[5] === 20) as number[])[6];
	const holdEndGroup = (cbtNotes.find(note => note[5] === 21) as number[])[6];
	expect(holdBeginGroup).toBe(holdEndGroup);
	const dragBeginGroup = (cbtNotes.find(note => note[5] === 30) as number[])[6];
	const dragEndGroup = (cbtNotes.find(note => note[5] === 32) as number[])[6];
	expect(dragBeginGroup).toBe(dragEndGroup);
	expect(holdBeginGroup).notToBe(dragBeginGroup);
});

test('Chart fromCbt', () => {
	const cbt: Cbt = {
		info: {
			bpm: 120,
			dir: '',
			delay: 0
		},
		notes: [
			[0, 8, 8, 0, 7, 1, 'bgm'],
			[1, 5, 8, 4, 1, 20, 0],
			[1, 4, 4, 0, 1, 10],
			[1, 5, 8, 3, 3, 21, 0],
			[1, 5, 2, 2, 1, 30, 1],
			[1, 5, 4, 1, 3, 32, 1]
		]
	};
	const chart = Chart.fromCbt(cbt);

	expect(chart.bpsList.initialBps).toBeApproximately(2);
	expect(chart.noteList.notes.length).toBe(5);
	expect(chart.noteList.notes[0].constructor).toBe(Hold);
	expect((chart.noteList.notes[0] as Hold).peers.length).toBe(2);
});

// 1 ch, 44.1 kHz, 4410 samples, y = sin2pi(t 440Hz)
const oggCompressed = Buffer.from(`
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
`, 'base64');
const oggFileEmbedded = new FileEmbedded(
	oggCompressed.buffer,
	oggCompressed.byteOffset,
	oggCompressed.byteLength
);
oggFileEmbedded.compressed = true;

const musicProvider = new MusicFromFileProvider(oggFileEmbedded);
const previewProvider = new PreviewFromMusicProvider(musicProvider);
previewProvider.length = 50;
previewProvider.fadeInLength = 10;
previewProvider.fadeOutLength = 10;
const coverProvider = new CoverEmptyProvider();

test('Music encode, decode', () => {
	const music = new Music(musicProvider, previewProvider, coverProvider);
	music.name = 'Test Music';
	music.artist = 'Test Artist';
	music.instrumental = true;
	music.vocal = false;
	music.keywords = ['keyword 1', 'keyword 2'];
	const chartInfo = music.newChart('EASY');
	chartInfo.difficultyText = '1';
	chartInfo.difficulty = 1100;

	const buffer = new ArrayBuffer(music.encodedLength());
	const dataView = new DataView(buffer);
	music.encode(dataView, 0);
	const music2 = Music.decode(dataView, 0);

	expect(music2.name).toBe(music.name);
	expect(music2.artist).toBe(music.artist);
	expect(music2.instrumental).toBe(music.instrumental);
	expect(music2.vocal).toBe(music.vocal);
	expect(music2.keywords.length).toBe(music.keywords.length);
	for (let i = 0; i < music.keywords.length; i++) {
		expect(music2.keywords[i]).toBe(music.keywords[i]);
	}
	expect(music2.chartCount()).toBe(music.chartCount());
	expect(music2.getChartInfo('EASY').difficultyName).toBe('EASY');
});

await test('Music audioBuffer', async () => {
	const music = new Music(musicProvider, previewProvider, coverProvider);
	const audioBuffer = await music.musicProvider.audioBuffer();
	expect(audioBuffer.sampleRate).toBe(44100);
	expect(audioBuffer.length).toBe(4410);
	expect(audioBuffer.numberOfChannels).toBe(1);
	const channelData = audioBuffer.getChannelData(0);
	for (let i = 0; i < channelData.length; i += 100) {
		expect(channelData[i]).toBeApproximately(Math.sin(i / 44100 * Math.PI*2 * 440), 5e-2);
	}
});

await test('Preview from music segment', async () => {
	const music = new Music(musicProvider, previewProvider, coverProvider);
	const audioBuffer = await music.previewProvider.audioBuffer();
	expect(audioBuffer.length).toBe(previewProvider.length);
	const channelData = audioBuffer.getChannelData(0);
	expect(channelData[4]).toBeApproximately(Math.sin(4/44100 * Math.PI*2 * 440) / 2, 5e-2);
	expect(channelData[25]).toBeApproximately(Math.sin(25/44100 * Math.PI*2 * 440), 5e-2);
	expect(channelData[45]).toBeApproximately(Math.sin(45/44100 * Math.PI*2 * 440) / 2, 5e-2);
});

console.error('All tests finished');

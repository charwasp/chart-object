import { ChartList } from './chart.js';
import { EmbedRequest, MusicProvider, PreviewProvider, CoverProvider } from './provider.js';
import { encodeString, decodeString, stringEncodedLength } from './utils.js';

class Music {

	/**
	 * The name of the music.
	 */
	name = '';

	/**
	 * The artist of the music.
	 */
	artist = '';

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
	categories = 0;

	/**
	 * Keywords that intend to assist searching.
	 */
	keywords: string[] = [];

	chartList = new ChartList();

	constructor(
		public musicProvider: MusicProvider,
		public previewProvider: PreviewProvider,
		public coverProvider: CoverProvider
	) {}

	/**
	 * Implemented as reading the bitmask in {@link categories}.
	 */
	get instrumental(): boolean {
		return !!(this.categories & 4);
	}

	/**
	 * Implemented as writing the bitmask in {@link categories}.
	 */
	set instrumental(value: boolean) {
		if (value) {
			this.categories |= 4;
		} else {
			this.categories &= ~4;
		}
	}

	/**
	 * Implemented as reading the bitmask in {@link categories}.
	 */
	get vocal(): boolean {
		return !!(this.categories & 8);
	}

	/**
	 * Implemented as writing the bitmask in {@link categories}.
	 */
	set vocal(value: boolean) {
		if (value) {
			this.categories |= 8;
		} else {
			this.categories &= ~8;
		}
	}

	newChart(difficultyName: string) {
		return this.chartList.newChart(difficultyName);
	}

	getChartInfo(difficultyName: string) {
		return this.chartList.getChartInfo(difficultyName);
	}

	chartCount(): number {
		return this.chartList.charts.size;
	}

	encodedLength(): number {
		return 4 + 1 +
			stringEncodedLength(this.name) + stringEncodedLength(this.artist) + 1 +
			this.musicProvider.totalEncodedLength() +
			this.previewProvider.totalEncodedLength() +
			this.coverProvider.totalEncodedLength() +
			1 + this.keywords.reduce((sum, keyword) => sum + stringEncodedLength(keyword), 0) +
			this.chartList.totalEncodedLength();
	}

	encode(output: DataView, offset: number): number {
		const embedRequests: EmbedRequest[] = [];
		output.setUint32(offset, 0x4d505743, true); // magic number
		offset += 4;
		output.setUint8(offset, 1); // version
		offset++;
		offset = encodeString(this.name, output, offset);
		offset = encodeString(this.artist, output, offset);
		output.setUint8(offset, this.categories);
		offset++;
		let newEmbedRequests: EmbedRequest[];
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

	static decode(input: DataView, offset: number): Music {
		const music = new Music(null, null, null);
		offset += 4; // magic number
		if (input.getUint8(offset) !== 1) {
			throw new Error('Unsupported version');
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

export { Music };

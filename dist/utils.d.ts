declare function encodeString(string: string, output: DataView, offset: number): number;
declare function decodeString(input: DataView, offset: number): string;
declare function stringEncodedLength(string: string): number;
export { encodeString, decodeString, stringEncodedLength, };

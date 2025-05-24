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
export { encodeString, decodeString, stringEncodedLength, };
//# sourceMappingURL=utils.js.map
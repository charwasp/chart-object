test('fail', () => {
	expect(0).toBe(1);
});

test('png-decode', async () => {
	const imageResponse = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIAAAUAAeImBZsAAAAASUVORK5CYII=');
	const imageBuffer = await imageResponse.arrayBuffer();
	const cover = new CharWasP.CoverFromFileProvider(new CharWasP.FileEmbedded(imageBuffer));
	const imageData = await cover.imageData();
	expect(imageData.width).toBe(1);
	expect(imageData.height).toBe(1);
});

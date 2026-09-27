export function parseColor(color: string | null | undefined): number | null {
	if (!color) return null;

	const parsedColor = parseInt(color, 16) + 0xff000000;
	const colorData = new Uint32Array([parsedColor]);
	const colorDataView = new DataView(colorData.buffer);
	return colorDataView.getInt32(0, true);
}

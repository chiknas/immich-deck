/**
 * Renders key faces as SVG data URIs for setImage().
 * SVG scales crisply on both 72px and 144px (XL / +) key hardware.
 *
 * Visual language for the monitoring row:
 *  - dark slate background, one status color per state
 *  - a thin status bar across the top = glanceable from across the room
 *  - big value in the middle, small label underneath
 */

export type Status = "ok" | "warn" | "error" | "stale" | "busy";

const COLORS: Record<Status, string> = {
	ok: "#2ecc71",
	warn: "#f1a53c",
	error: "#e74c3c",
	stale: "#7f8c9a",
	busy: "#4aa3df"
};

const BG = "#151a21";
const FG = "#e8edf2";
const MUTED = "#8b97a5";

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toDataUri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export type KeyFace = {
	status: Status;
	value: string; // big center text, keep under ~8 chars
	label: string; // small caption
	subValue?: string; // optional second line under the value
	/** 0..1 — draws a fill bar (used by storage) */
	gauge?: number;
};

export function renderKeyFace(face: KeyFace): string {
	const c = COLORS[face.status];
	const valueSize = face.value.length > 6 ? 30 : 38;

	const gauge =
		face.gauge !== undefined
			? `<rect x="20" y="112" width="104" height="8" rx="4" fill="#2a323d"/>
			   <rect x="20" y="112" width="${Math.max(6, Math.round(104 * Math.min(face.gauge, 1)))}" height="8" rx="4" fill="${c}"/>`
			: "";

	const sub = face.subValue
		? `<text x="72" y="${face.gauge !== undefined ? 100 : 104}" font-size="17" fill="${MUTED}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">${esc(face.subValue)}</text>`
		: "";

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
	<rect width="144" height="144" rx="16" fill="${BG}"/>
	<rect x="0" y="0" width="144" height="10" fill="${c}"/>
	<text x="72" y="${sub || gauge ? 76 : 84}" font-size="${valueSize}" font-weight="700" fill="${FG}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">${esc(face.value)}</text>
	${sub}
	${gauge}
	<text x="72" y="${face.gauge !== undefined ? 138 : 132}" font-size="15" letter-spacing="1" fill="${MUTED}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">${esc(face.label.toUpperCase())}</text>
</svg>`;
	return toDataUri(svg);
}

/** Full-face light for the health key: just color + one word. */
export function renderStatusLight(status: Status, text: string, label: string): string {
	const c = COLORS[status];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
	<rect width="144" height="144" rx="16" fill="${BG}"/>
	<circle cx="72" cy="62" r="34" fill="${c}" opacity="0.18"/>
	<circle cx="72" cy="62" r="20" fill="${c}"/>
	<text x="72" y="112" font-size="22" font-weight="700" fill="${FG}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">${esc(text)}</text>
	<text x="72" y="136" font-size="14" letter-spacing="1" fill="${MUTED}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">${esc(label.toUpperCase())}</text>
</svg>`;
	return toDataUri(svg);
}

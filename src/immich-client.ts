/**
 * Minimal Immich REST client for the monitoring row.
 *
 * Immich moved its server endpoints from /api/server-info/* to /api/server/*
 * around v1.107, so every call tries the modern path first and falls back.
 * Verify against your instance's live spec at {serverUrl}/api/docs if in doubt.
 */

export type GlobalSettings = {
	serverUrl?: string; // e.g. http://192.168.1.50:2283
	apiKey?: string;
	glancesUrl?: string; // e.g. http://192.168.1.50:61208 (for CPU/RAM key)
	pollSeconds?: number; // default 30
};

export type ServerStats = {
	photos: number;
	videos: number;
	usage: number; // bytes used by Immich library
};

export type StorageInfo = {
	diskUse: string; // human string from API, e.g. "1.2 TiB"
	diskSize: string;
	diskUsagePercentage: number;
};

export type JobSummary = {
	active: number;
	waiting: number;
	failed: number;
};

export class ImmichClient {
	constructor(
		private baseUrl: string,
		private apiKey: string
	) {
		this.baseUrl = baseUrl.replace(/\/+$/, "");
	}

	private async get<T>(paths: string[]): Promise<T> {
		let lastErr: unknown;
		for (const path of paths) {
			try {
				const res = await fetch(`${this.baseUrl}${path}`, {
					headers: { "x-api-key": this.apiKey, Accept: "application/json" },
					signal: AbortSignal.timeout(8000)
				});
				if (res.status === 404) {
					lastErr = new Error(`404 ${path}`);
					continue; // try legacy path
				}
				if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
				return (await res.json()) as T;
			} catch (err) {
				lastErr = err;
			}
		}
		throw lastErr;
	}

	/** True if the API answers the ping endpoint. */
	async ping(): Promise<boolean> {
		try {
			const r = await this.get<{ res: string }>(["/api/server/ping", "/api/server-info/ping"]);
			return r?.res === "pong";
		} catch {
			return false;
		}
	}

	/** Requires an admin API key. */
	async statistics(): Promise<ServerStats> {
		const r = await this.get<ServerStats>([
			"/api/server/statistics",
			"/api/server-info/statistics"
		]);
		return { photos: r.photos ?? 0, videos: r.videos ?? 0, usage: r.usage ?? 0 };
	}

	async storage(): Promise<StorageInfo> {
		const r = await this.get<StorageInfo>(["/api/server/storage", "/api/server-info/storage"]);
		return r;
	}

	/** Sums job counts across all Immich queues. */
	async jobs(): Promise<JobSummary> {
		type Queue = { jobCounts?: { active?: number; waiting?: number; delayed?: number; failed?: number } };
		const r = await this.get<Record<string, Queue>>(["/api/jobs"]);
		const sum: JobSummary = { active: 0, waiting: 0, failed: 0 };
		for (const q of Object.values(r)) {
			sum.active += q.jobCounts?.active ?? 0;
			sum.waiting += (q.jobCounts?.waiting ?? 0) + (q.jobCounts?.delayed ?? 0);
			sum.failed += q.jobCounts?.failed ?? 0;
		}
		return sum;
	}
}

/** Formats bytes into a short human string for a 72px key face. */
export function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const v = bytes / 1024 ** i;
	return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** 12871 -> "12.9k" — keeps big counts readable on the key. */
export function compactNumber(n: number): string {
	if (n < 10_000) return n.toLocaleString("en-US");
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(2)}M`;
}

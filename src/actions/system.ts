import { action, KeyAction } from "@elgato/streamdeck";
import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderKeyFace, Status } from "../key-face";

/**
 * Immich's API doesn't expose host CPU/RAM, so this key reads from Glances
 * (https://github.com/nicolargo/glances) running on the server:
 *
 *   docker run -d --restart=always -p 61208:61208 --pid host nicolargo/glances -w
 *
 * Set the Glances URL in the key settings. Works with Glances API v4 and v3.
 */
@action({ UUID: "com.immichdeck.system" })
export class SystemStats extends PollingAction {
	protected async refresh(actionKey: KeyAction, _c: ImmichClient, settings: GlobalSettings): Promise<void> {
		if (!settings.glancesUrl) {
			await actionKey.setImage(
				renderKeyFace({ status: "stale", value: "SET UP", label: "glances url" })
			);
			return;
		}
		const base = settings.glancesUrl.replace(/\/+$/, "");

		const [cpu, mem] = await Promise.all([
			this.fetchGlances<{ total: number }>(base, "cpu"),
			this.fetchGlances<{ percent: number }>(base, "mem")
		]);

		const cpuPct = Math.round(cpu.total);
		const memPct = Math.round(mem.percent);

		let status: Status = "ok";
		if (cpuPct >= 90 || memPct >= 90) status = "error";
		else if (cpuPct >= 70 || memPct >= 80) status = "warn";

		await actionKey.setImage(
			renderKeyFace({
				status,
				value: `${cpuPct}%`,
				subValue: `RAM ${memPct}%`,
				label: "cpu"
			})
		);
	}

	private async fetchGlances<T>(base: string, plugin: string): Promise<T> {
		for (const version of ["4", "3"]) {
			try {
				const res = await fetch(`${base}/api/${version}/${plugin}`, {
					headers: { Accept: "application/json" },
					signal: AbortSignal.timeout(6000)
				});
				if (res.ok) return (await res.json()) as T;
			} catch {
				/* try next version */
			}
		}
		throw new Error(`Glances unreachable at ${base}`);
	}
}

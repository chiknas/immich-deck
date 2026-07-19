import { action, KeyAction } from "@elgato/streamdeck";
import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderKeyFace, Status } from "../key-face";

@action({ UUID: "com.immichdeck.jobs" })
export class ActiveJobs extends PollingAction {
	protected async refresh(actionKey: KeyAction, client: ImmichClient, _s: GlobalSettings): Promise<void> {
		const jobs = await client.jobs();

		let status: Status = "ok";
		if (jobs.failed > 0) status = "error";
		else if (jobs.active > 0) status = "busy";

		const value = jobs.active > 0 ? `${jobs.active}` : "Idle";
		const parts: string[] = [];
		if (jobs.waiting > 0) parts.push(`${jobs.waiting} queued`);
		if (jobs.failed > 0) parts.push(`${jobs.failed} failed`);

		await actionKey.setImage(
			renderKeyFace({
				status,
				value,
				subValue: parts.join(" · ") || undefined,
				label: jobs.active > 0 ? "jobs running" : "jobs"
			})
		);
	}
}

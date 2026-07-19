import { action, KeyAction } from "@elgato/streamdeck";
import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderKeyFace, Status } from "../key-face";

@action({ UUID: "com.immichdeck.storage" })
export class StorageUsed extends PollingAction {
	protected async refresh(actionKey: KeyAction, client: ImmichClient, _s: GlobalSettings): Promise<void> {
		const st = await client.storage();
		const pct = Math.round(st.diskUsagePercentage ?? 0);

		let status: Status = "ok";
		if (pct >= 90) status = "error";
		else if (pct >= 75) status = "warn";

		await actionKey.setImage(
			renderKeyFace({
				status,
				value: `${pct}%`,
				subValue: `${st.diskUse} / ${st.diskSize}`,
				gauge: pct / 100,
				label: "storage"
			})
		);
	}
}

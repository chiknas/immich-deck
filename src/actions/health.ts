import { action, KeyAction } from "@elgato/streamdeck";
import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderStatusLight } from "../key-face";

@action({ UUID: "com.immichdeck.health" })
export class ServerHealth extends PollingAction {
	protected async refresh(actionKey: KeyAction, client: ImmichClient, _s: GlobalSettings): Promise<void> {
		const alive = await client.ping();
		await actionKey.setImage(
			alive
				? renderStatusLight("ok", "Online", "immich")
				: renderStatusLight("error", "Down", "immich")
		);
	}
}

import { action, KeyAction } from "@elgato/streamdeck";
import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient, compactNumber } from "../immich-client";
import { renderKeyFace } from "../key-face";

@action({ UUID: "com.immichdeck.assets" })
export class AssetCount extends PollingAction {
	protected async refresh(actionKey: KeyAction, client: ImmichClient, _s: GlobalSettings): Promise<void> {
		const stats = await client.statistics();
		await actionKey.setImage(
			renderKeyFace({
				status: "ok",
				value: compactNumber(stats.photos + stats.videos),
				subValue: `${compactNumber(stats.photos)} ph · ${compactNumber(stats.videos)} vid`,
				label: "assets"
			})
		);
	}
}

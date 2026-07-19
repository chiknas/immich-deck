import streamDeck, {
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
	KeyDownEvent,
	KeyAction
} from "@elgato/streamdeck";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderKeyFace } from "../key-face";

/**
 * Shared skeleton for the monitoring row:
 *  - starts a poll timer per visible key, stops it when the key disappears
 *  - pressing a key forces an immediate refresh
 *  - renders an error face when the server is unreachable / misconfigured
 *
 * Subclasses implement refresh() and paint whatever they want.
 */
export abstract class PollingAction extends SingletonAction {
	private timers = new Map<string, NodeJS.Timeout>();

	protected abstract refresh(action: KeyAction, client: ImmichClient, settings: GlobalSettings): Promise<void>;

	protected async getGlobals(): Promise<GlobalSettings> {
		return (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
	}

	private async tick(action: KeyAction): Promise<void> {
		const settings = await this.getGlobals();
		if (!settings.serverUrl || !settings.apiKey) {
			await action.setImage(
				renderKeyFace({ status: "stale", value: "SET UP", label: "no config" })
			);
			return;
		}
		try {
			const client = new ImmichClient(settings.serverUrl, settings.apiKey);
			await this.refresh(action, client, settings);
		} catch (err) {
			streamDeck.logger.warn(`refresh failed: ${err}`);
			await action.setImage(renderKeyFace({ status: "error", value: "ERR", label: "offline?" }));
		}
	}

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;
		const settings = await this.getGlobals();
		const interval = Math.max(5, settings.pollSeconds ?? 30) * 1000;

		await this.tick(ev.action); // paint immediately
		this.clearTimer(ev.action.id);
		this.timers.set(
			ev.action.id,
			setInterval(() => void this.tick(ev.action as KeyAction), interval)
		);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		this.clearTimer(ev.action.id);
	}

	/** Pressing any monitor key = force refresh now. */
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.tick(ev.action);
	}

	private clearTimer(id: string): void {
		const t = this.timers.get(id);
		if (t) clearInterval(t);
		this.timers.delete(id);
	}
}

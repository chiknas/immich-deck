import {
	action,
	KeyAction,
	KeyDownEvent,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

import { PollingAction } from "./base-polling";
import { GlobalSettings, ImmichClient } from "../immich-client";
import { renderKeyFace, Status } from "../key-face";

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);


enum DisplayMode {
	Signal = 0,
	SSID = 1,
	IP = 2,
	Gateway = 3,
	Ping = 4
}


type WifiInfo = {
	connected: boolean;
	ssid: string;
	signal: number;
	ip: string;
	gateway: string;
	ping: string | null;
};


@action({ UUID: "com.immichdeck.system" })
export class SystemStats extends PollingAction {

	private modes = new Map<string, DisplayMode>();

	private wifiCache: WifiInfo = {
		connected: false,
		ssid: "--",
		signal: 0,
		ip: "--",
		gateway: "--",
		ping: null
	};

	private lastUpdate = 0;


	protected async refresh(
		actionKey: KeyAction,
		_client: ImmichClient,
		_settings: GlobalSettings
	): Promise<void> {

		const mode =
			this.modes.get(actionKey.id) ?? DisplayMode.Signal;


		if (Date.now() - this.lastUpdate > 10000) {
			this.wifiCache = await this.getWifiInfo(
				mode === DisplayMode.Ping
			);
			this.lastUpdate = Date.now();
		}


		const wifi = this.wifiCache;


		if (!wifi.connected) {
			await actionKey.setImage(
				renderKeyFace({
					status: "error",
					value: "OFF",
					label: "Wi-Fi"
				})
			);
			return;
		}


		let value = "";
		let subValue = "";
		let label = "";
		let status: Status = "ok";


		switch (mode) {

			case DisplayMode.Signal:

				value = `${wifi.signal}%`;
				subValue = wifi.ssid;
				label = "Wi-Fi";

				if (wifi.signal < 40) {
					status = "error";
				} else if (wifi.signal < 70) {
					status = "warn";
				}

				break;


			case DisplayMode.SSID:
			{
				const ssid = wifi.ssid;

				if (ssid.length > 12) {
					const splitAt = Math.ceil(ssid.length / 2);
					value = ssid.substring(0, splitAt);
					subValue = ssid.substring(splitAt);
				} else {
					value = ssid;
				}

				label = "SSID";
				break;
			}


			case DisplayMode.IP:
			{
				const parts = wifi.ip.split(".");

				if (parts.length === 4) {
					value = `${parts[0]}.${parts[1]}`;
					subValue = `${parts[2]}.${parts[3]}`;
				} else {
					value = wifi.ip;
				}

				label = "IP";
				break;
			}


			case DisplayMode.Gateway:
			{
				const parts = wifi.gateway.split(".");

				if (parts.length === 4) {
					value = `${parts[0]}.${parts[1]}`;
					subValue = `${parts[2]}.${parts[3]}`;
				} else {
					value = wifi.gateway;
				}

				label = "GW";
				break;
			}


			case DisplayMode.Ping:

				value = wifi.ping
					? `${wifi.ping}ms`
					: "--";

				label = "Internet";
				break;
		}


		await actionKey.setImage(
			renderKeyFace({
				status,
				value,
				subValue,
				label
			})
		);
	}



	override async onWillAppear(
		ev: WillAppearEvent
	): Promise<void> {

		if (!ev.action.isKey()) {
			return;
		}

		await this.refresh(
			ev.action as KeyAction,
			{} as ImmichClient,
			{} as GlobalSettings
		);
	}



	override onWillDisappear(
		_ev: WillDisappearEvent
	): void {
	}



	override async onKeyDown(
		ev: KeyDownEvent
	): Promise<void> {

		if (!ev.action.isKey()) {
			return;
		}


		const action = ev.action as KeyAction;


		const current =
			this.modes.get(action.id)
			?? DisplayMode.Signal;


		const next =
			current === DisplayMode.Ping
				? DisplayMode.Signal
				: current + 1;


		this.modes.set(
			action.id,
			next
		);


		await this.refresh(
			action,
			{} as ImmichClient,
			{} as GlobalSettings
		);
	}



	private async getWifiInfo(
		includePing: boolean
	): Promise<WifiInfo> {

		const { stdout } =
			await execAsync(
				"netsh wlan show interfaces"
			);


		const get = (name: string) =>
			stdout.match(
				new RegExp(
					`^\\s*${name}\\s*:\\s*(.+)$`,
					"mi"
				)
			)?.[1]?.trim() ?? "";



		const signal =
			parseInt(
				get("Signal").replace("%", ""),
				10
			) || 0;



		let ip = "--";
		let gateway = "--";


		try {

			const { stdout } =
				await execAsync(
					'powershell -Command "Get-NetIPConfiguration -InterfaceAlias \\"Wi-Fi\\" | ConvertTo-Json"'
				);


			const net = JSON.parse(stdout);


			ip =
				net.IPv4Address?.IPAddress ?? "--";


			gateway =
				net.IPv4DefaultGateway?.NextHop ?? "--";


		} catch {
		}



		let ping: string | null = null;


		if (includePing) {

			try {

				const { stdout } =
					await execAsync(
						"ping -n 1 8.8.8.8"
					);


				ping =
					stdout.match(
						/time[=<](\d+)ms/i
					)?.[1] ?? null;


			} catch {
			}
		}



		return {
			connected:
				get("State").toLowerCase() === "connected",

			ssid:
				get("SSID"),

			signal,
			ip,
			gateway,
			ping
		};
	}
}
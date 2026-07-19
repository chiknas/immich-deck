import {
	action,
	KeyAction,
	KeyDownEvent
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

	private cache: WifiInfo = {
		connected: false,
		ssid: "--",
		signal: 0,
		ip: "--",
		gateway: "--",
		ping: null
	};

	private lastRefresh = 0;


	protected async refresh(
		actionKey: KeyAction,
		_client: ImmichClient,
		_settings: GlobalSettings
	): Promise<void> {

		const mode =
			this.modes.get(actionKey.id) ?? DisplayMode.Signal;


		// Refresh data every 5 seconds only
		if (Date.now() - this.lastRefresh > 5000) {
			this.cache = await this.getWifiInfo(
				mode === DisplayMode.Ping
			);

			this.lastRefresh = Date.now();
		}


		const wifi = this.cache;


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

				if (wifi.signal < 40)
					status = "error";
				else if (wifi.signal < 70)
					status = "warn";

				break;


			case DisplayMode.SSID:

				value = wifi.ssid.length > 12
					? wifi.ssid.substring(0, 12)
					: wifi.ssid;

				subValue = wifi.ssid.length > 12
					? wifi.ssid.substring(12)
					: "";

				label = "SSID";

				break;


			case DisplayMode.IP:

				{
					const parts = wifi.ip.split(".");

					value =
						parts.length === 4
							? `${parts[0]}.${parts[1]}`
							: wifi.ip;

					subValue =
						parts.length === 4
							? `${parts[2]}.${parts[3]}`
							: "";

					label = "IP";
				}

				break;


			case DisplayMode.Gateway:

				{
					const parts = wifi.gateway.split(".");

					value =
						parts.length === 4
							? `${parts[0]}.${parts[1]}`
							: wifi.gateway;

					subValue =
						parts.length === 4
							? `${parts[2]}.${parts[3]}`
							: "";

					label = "GW";
				}

				break;


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



	override async onKeyDown(
		ev: KeyDownEvent
	): Promise<void> {

		if (!ev.action.isKey())
			return;


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

		const { stdout: wifiOutput } =
			await execAsync(
				"netsh wlan show interfaces"
			);


		const getWifi = (name: string) =>
			wifiOutput.match(
				new RegExp(
					`^\\s*${name}\\s*:\\s*(.+)$`,
					"mi"
				)
			)?.[1]?.trim() ?? "";


		let ip = "--";
		let gateway = "--";


		try {

			const { stdout } =
				await execAsync(
					'powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like \\"192.168.*\\"} | Select-Object -ExpandProperty IPAddress"'
				);


			ip =
				stdout.trim() || "--";


		} catch {
		}



		try {

			const { stdout } =
				await execAsync(
					'powershell -Command "Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Select-Object -First 1 -ExpandProperty NextHop"'
				);


			gateway =
				stdout.trim() || "--";


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
				getWifi("State").toLowerCase() === "connected",

			ssid:
				getWifi("SSID") || "--",

			signal:
				parseInt(
					getWifi("Signal").replace("%", ""),
					10
				) || 0,

			ip,
			gateway,
			ping
		};
	}
}
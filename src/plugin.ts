import streamDeck from "@elgato/streamdeck";

import { ServerHealth } from "./actions/health";
import { AssetCount } from "./actions/assets";
import { StorageUsed } from "./actions/storage";
import { ActiveJobs } from "./actions/jobs";
import { SystemStats } from "./actions/system";

streamDeck.actions.registerAction(new ServerHealth());
streamDeck.actions.registerAction(new AssetCount());
streamDeck.actions.registerAction(new StorageUsed());
streamDeck.actions.registerAction(new ActiveJobs());
streamDeck.actions.registerAction(new SystemStats());

streamDeck.connect();

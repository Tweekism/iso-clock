import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export default class IsoClock extends Extension {
	enable() {
		const dateMenu = Main.panel.statusArea.dateMenu;

		const clockDisplayBox = dateMenu
			.get_children()
			.find((x) => x.style_class === "clock-display-box");

		this.label = clockDisplayBox?.get_children().find(
			(x) =>
				x.style_class === "clock" &&
				// Make sure it's (hopefully) the clock
				// by checking for "∶" (\u2236) (not ascii ":")
				x.text?.includes("\u2236")
		);

		if (!this.label) {
			console.error("No clock label? Aborting.");
			return;
		}

		const gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");

		const formats = [
			"%H:%M",
			"%Y-%m-%d %H:%M",
			"%H:%M:%S",
			"%Y-%m-%d %H:%M:%S",
			"%A   %H:%M",
			"%A   %Y-%m-%d   %H:%M",
			"%A   %H:%M:%S",
			"%A   %Y-%m-%d   %H:%M:%S",
		];

		const override = () => {
			// Don't do anything if the clock label hasn't actually changed
			if (this.newClock == this.label.get_text()) {
				return;
			}

			const now = GLib.DateTime.new_now_local();

			const d = gnomeSettings.get_boolean("clock-show-date");
			const s = gnomeSettings.get_boolean("clock-show-seconds");
			const w = gnomeSettings.get_boolean("clock-show-weekday");

			const format = (d << 0) | (s << 1) | (w << 2);

			this.newClock = now.format(formats[format]);
			this.defaultClock = this.label.get_text();
			this.label.set_text(this.newClock);
		};

		this.handlerid = this.label.connect("notify::text", override);
		override();
	}

	disable() {
		if (this.handlerid) {
			this.label.disconnect(this.handlerid);
			this.handlerid = null;

			this.label.set_text(this.defaultClock);
			this.label = null;

			this.newClock = null;
			this.defaultClock = null;
		}
	}
}

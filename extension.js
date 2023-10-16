import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export default class IsoClock extends Extension {
	enable() {
		const dateMenu = Main.panel.statusArea.dateMenu;

		for (const child of dateMenu.first_child.get_children()) {
			if (child.style_class == "clock") {
				this.label = child;
				break;
			}
		}

		if (!this.label) {
			print("No clock label? Aboring.");
			return;
		}

		const gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");

		const formats = [
			"%H:%M",
			"%Y-%m-%d %H:%M",
			"%H:%M:%S",
			"%Y-%m-%d %H:%M:%S",
			"W%V-%u %H:%M",
			"%Y-%m-%d  W%V-%u %H:%M",
			"W%V-%u %H:%M:%S",
			"%Y-%m-%d  W%V-%u %H:%M:%S",
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

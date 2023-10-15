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

		const gnome_settings = Gio.Settings.new("org.gnome.desktop.interface");

		const formats = [
			"%Y-%m-%d %H:%M", // No seconds
			"%Y-%m-%d %H:%M:%S", // Seconds
		];

		const override = () => {
			// Don't do anything if the clock label hasn't actually changed
			if (this.new_clock == this.label.get_text()) {
				return;
			}

			const now = GLib.DateTime.new_now_local();

			// Pick a format that respects user's setting
			const show_seconds =
				gnome_settings.get_boolean("clock-show-seconds");

			this.new_clock = now.format(formats[Number(show_seconds)]);
			this.default_clock = this.label.get_text();
			this.label.set_text(this.new_clock);
		};

		this.handlerid = this.label.connect("notify::text", override);
		override();
	}

	disable() {
		if (this.handlerid) {
			this.label.disconnect(this.handlerid);
			this.handlerid = null;

			this.label.set_text(this.default_clock);
			this.label = null;

			this.new_clock = null;
			this.default_clock = null;
		}
	}
}
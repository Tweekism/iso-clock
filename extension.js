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
		const gnomeCalendar = Gio.Settings.new("org.gnome.desktop.calendar");

		const override = () => {
			// Don't do anything if the clock label hasn't actually changed
			if (this.newClock == this.label.get_text()) {
				return;
			}

			const now = GLib.DateTime.new_now_local();

			let day, date, week, time;

			if (gnomeSettings.get_boolean("clock-show-weekday")) {
				day = "%A"
			}

			if (gnomeSettings.get_boolean("clock-show-date")) {
				date = "%Y-%m-%d";
			}

			if (gnomeCalendar.get_boolean("show-weekdate")) {
				week = "W%V-%u"
			}

			if (gnomeSettings.get_string("clock-format") === '24h') {
				time = "%H:%M";
			} else {
				time = "%I:%M %p";
			}

			if (gnomeSettings.get_boolean("clock-show-seconds")) {
				time = time.replace("%M","%M:%S");
			}

			const format = [day, date, week, time].filter(v => v).join("   ");

			this.newClock = now.format(format);
			this.defaultClock = this.label.get_text();
			this.label.set_text(this.newClock);
		};

		this.labelHandleId = this.label.connect("notify::text", override);
		// We also need to know when the "Week Numbers" setting changes
		// when it does, trigger a refresh by setting clock back to its default value
		this.calendarHandleId = gnomeCalendar.connect("changed::show-weekdate", () => {
		    this.label.set_text(this.defaultClock); 
		})
		override();
	}

	disable() {
		if (this.calendarHandleID) {
			this.label.disconnect(this.calendarHandleID);
			this.calendarHandleID = null;
                }

		if (this.labelHandleId) {
			this.label.disconnect(this.labelHandleId);
			this.labelHandleId = null;

			this.label.set_text(this.defaultClock);
			this.label = null;

			this.newClock = null;
			this.defaultClock = null;
		}
	}
}

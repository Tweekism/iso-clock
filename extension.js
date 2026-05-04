// This extenstion is based on S410's original ISO8601-ish Clock
// https://gitlab.com/S410/iso8601ish

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from 'gi://St';
import Clutter from 'gi://Clutter';

export default class IsoClock extends Extension {
    enable() {
        this.originalClockLabel = this.getClockFromPanel(Main.panel)

        if (!this.originalClockLabel) {
            console.error("No clock label? Aborting.");
            return;
        }

        this.isoClocks = []
        this.createClocks();

        const gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");
        this.gnomeCalendar = Gio.Settings.new("org.gnome.desktop.calendar");

        const override = () => {
            // Don't do anything if the clock label hasn't actually changed
            if (this.isoTimeString == this.originalClockLabel.get_text()) {
                return;
            }

            // Setup the custom clock format based on the clock settings in Gnome Settings
            let day, date, week, time;

            if (gnomeSettings.get_boolean("clock-show-weekday")) {
                day = "%A"
            }

            if (gnomeSettings.get_boolean("clock-show-date")) {
                date = "%Y-%m-%d";
            }

            if (this.gnomeCalendar.get_boolean("show-weekdate")) {
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

            // Set the clock label to our new custom format
            const now = GLib.DateTime.new_now_local();
            this.isoClocks.forEach(clock => {
                clock.set_text(now.format(format));
            });
        };

        // Whenever the clock label updates override with our custom clock format
        this.mainClockHandleId = this.originalClockLabel.connect("notify::text", override);

        // TODO: Update this comment, as it's no longer true
        // We also need to know when the "Week Numbers" setting changes, as week numbers
        // don't appear in the default clock. Trigger a refresh by setting clock back to 
        // its default value. This prevents an edge case where disabling the extension 
        // after a week number setting change causes unexpected behaviour
        this.calendarHandleId = this.gnomeCalendar.connect("changed::show-weekdate", () => {
            override();
        })
        override();
    }

    disable() {
        if (this.calendarHandleId) {
            this.gnomeCalendar.disconnect(this.calendarHandleId);
            this.calendarHandleId = null;
        }

        if (this.mainClockHandleId) {
            this.originalClockLabel.disconnect(this.mainClockHandleId);
            this.mainClockHandleId = null;
        }

        this.destroyClocks();

        this.originalClockLabel.show();
        this.gnomeCalendar = null
        this.originalClockLabel = null;
    }

    getClockFromPanel(panel) {
        const dateMenu = panel?.statusArea?.dateMenu;
        if (!dateMenu) return null;

        const clockDisplayBox = dateMenu
            .get_children()
            .find((x) => x.style_class === "clock-display-box");

        return clockDisplayBox?.get_children().find(
            (x) => x.style_class === "clock"
        ) || null;
    }

    cloneClock(original) {
        const clock = new St.Label({
            style_class: 'clock',
            text: 'Initializing...',
            y_expand: 0,
            y_align: 0
        });
        clock.get_clutter_text().set_y_align(Clutter.ActorAlign.CENTER);
        original.get_parent().insert_child_above(clock, original);
        // original.hide();
        return clock
    }

    createClocks() {
        // Hide the original clock and create our own
        this.isoClocks.push(this.cloneClock(this.originalClockLabel));

        // If Dash to Panel is running, clone those too
        if (global.dashToPanel) {
            global.dashToPanel.panels.forEach(panel => {
                this.isoClocks.push(this.cloneClock(this.getClockFromPanel(panel)));
            });
        }
    }

    destroyClocks() {
        this.isoClocks.forEach(clock => {
            if (clock) {
                clock.destroy();
            }
        });
        this.isoClocks = [];
    }
}

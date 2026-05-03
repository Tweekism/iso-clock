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

        // Hide the original clock and create our own
        this.isoClockLabel = new St.Label({
            style_class: 'clock',
            text: 'Initializing...',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.originalClockLabel.get_parent().add_child(this.isoClockLabel);

        // If Dash to Panel is running, get those clock labels too
        if (global.dashToPanel) {
            this.dashToPanelClocks = [];
            global.dashToPanel.panels.forEach(panel => {
                this.dashToPanelClocks.push(this.getClockFromPanel(panel));
            });
        }

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

            // Keep a copy of the default clock text so that we can revert it when the
            // extension is disabled
            this.defaultTimeString = this.originalClockLabel.get_text();

            // Set the clock label to our new custom format
            const now = GLib.DateTime.new_now_local();
            this.isoTimeString = now.format(format);
            this.originalClockLabel.set_text(this.isoTimeString);
            this.isoClockLabel.set_text(now.format(format));

            this.dashToPanelClocks.forEach(clock => {
                if (clock) {
                    clock.set_text(this.isoTimeString);
                    clock.hide();
                }
            })
        };

        // Whenever the clock label updates override with our custom clock format
        this.mainClockHandleId = this.originalClockLabel.connect("notify::text", override);

        // We also need to know when the "Week Numbers" setting changes, as week numbers
        // don't appear in the default clock. Trigger a refresh by setting clock back to 
        // its default value. This prevents an edge case where disabling the extension 
        // after a week number setting change causes unexpected behaviour
        this.calendarHandleId = this.gnomeCalendar.connect("changed::show-weekdate", () => {
            this.originalClockLabel.set_text(this.defaultTimeString);
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

        if (this.defaultTimeString) {
            this.originalClockLabel.set_text(this.defaultTimeString);
        }

        this.gnomeCalendar = null
        this.originalClockLabel = null;
        this.isoTimeString = null;
        this.defaultTimeString = null;
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
}

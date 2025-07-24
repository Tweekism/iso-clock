// This extenstion is based on S410's original ISO8601-ish Clock
// https://gitlab.com/S410/iso8601ish

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';


export default class IsoClock extends Extension {
    enable() {
        const dateMenu = Main.panel.statusArea.dateMenu;

        const clockDisplayBox = dateMenu
            .get_children()
            .find((x) => x.style_class === "clock-display-box");

        // WIP: Test adding our own clock label that is easy to clean up
        this._clockTest = new St.Label({style_class: 'clock'});
        this._clockTest.clutter_text.y_align = Clutter.ActorAlign.CENTER;
        this._clockTest.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._clockTest.set_text("Hello World");
        clockDisplayBox.add_child(this._clockTest);

        this.label = clockDisplayBox?.get_children().find(
            (x) => x.style_class === "clock"
        );

        if (!this.label) {
            console.error("No clock label? Aborting.");
            return;
        }

        // WIP: More test thingy
        //TODO: Find way to temp hide the original clock label?

        const gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");
        this.gnomeCalendar = Gio.Settings.new("org.gnome.desktop.calendar");

        const override = () => {
            // Don't do anything if the clock label hasn't actually changed
            if (this.newClock == this.label.get_text()) {
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
            this.defaultClock = this.label.get_text();

            // Set the clock label to our new custom format
            const now = GLib.DateTime.new_now_local();
            this.newClock = now.format(format);
            this.label.set_text(this.newClock);
        };

        // Whenever the clock label updates override with our custom clock format
        this.labelHandleId = this.label.connect("notify::text", override);

        // We also need to know when the "Week Numbers" setting changes, as week numbers
        // don't appear in the default clock. Trigger a refresh by setting clock back to 
        // its default value. This prevents an edge case where disabling the extension 
        // after a week number setting change causes unexpected behaviour
        this.calendarHandleId = this.gnomeCalendar.connect("changed::show-weekdate", () => {
            this.label.set_text(this.defaultClock);
        })
        override();
    }

    disable() {
        if (this.calendarHandleId) {
            this.gnomeCalendar.disconnect(this.calendarHandleId);
            this.calendarHandleId = null;
        }

        if (this.labelHandleId) {
            this.label.disconnect(this.labelHandleId);
            this.labelHandleId = null;
        }

        if (this.defaultClock) {
            this.label.set_text(this.defaultClock);
        }

        this.gnomeCalendar = null
        this.label = null;
        this.newClock = null;
        this.defaultClock = null;
    }
}

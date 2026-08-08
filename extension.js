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
        this.mainClock = this.getClockFromPanel(Main.panel)
        if (!this.mainClock) {
            console.error("No clock label? Aborting.");
            return;
        }

        this.gnomeCalendar = Gio.Settings.new("org.gnome.desktop.calendar");
        this.isoClocks = []
        this.createClocks();

        // Whenever the main clock label changes, update all our clocks
        this.mainClockHandleId = this.mainClock.connect("notify::text", () => {
            this.updateClocks();
        });

        // Also update clocks when the "Week Numbers" setting changes. Week numbers
        // don't appear in the default clock, so we'll watch the Gnome Settings
        // handle for that.
        this.calendarHandleId = this.gnomeCalendar.connect("changed::show-weekdate", () => {
            this.updateClocks();
        })

        // Dash to Panel re-creates its panels on layout changes (monitors,
        // position, orientation...), so watch for that and re-clone the clocks
        // on the new panels.
        this.dashToPanelHandleId = null;
        if (global.dashToPanel) {
            this.dashToPanelHandleId = global.dashToPanel.connect("panels-created", () => {
                this.destroyClocks();
                this.createClocks();
                this.updateClocks();
            });
        }
        this.updateClocks();
    }

    disable() {
        if (this.calendarHandleId) {
            this.gnomeCalendar.disconnect(this.calendarHandleId);
            this.calendarHandleId = null;
        }

        if (this.mainClockHandleId) {
            this.mainClock.disconnect(this.mainClockHandleId);
            this.mainClockHandleId = null;
        }

        if (this.dashToPanelHandleId) {
            global.dashToPanel.disconnect(this.dashToPanelHandleId);
            this.dashToPanelHandleId = null;
        }

        this.destroyClocks();

        this.gnomeCalendar = null
        this.mainClock = null;
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
        this.isoClocks.push(this.cloneClock(this.mainClock));
        this.mainClock.hide();

        // If Dash to Panel is running, clone those too
        if (global.dashToPanel) {
            global.dashToPanel.panels.forEach(panel => {
                const clock = this.getClockFromPanel(panel);
                if (panel.getOrientation() === 'vertical') {
                    return
                }
                // If Dash to Panel is re-using the main clock, don't clone it again
                if (clock !== this.mainClock) {
                    this.isoClocks.push(this.cloneClock(clock));
                    clock.hide();
                }
            });
        }
    }

    updateClocks() {
        // Set our clock labels to our new custom format
        const now = GLib.DateTime.new_now_local();
        this.isoClocks.forEach(clock => {
            clock.set_text(now.format(this.getIsoFormat()));
        });
    }

    destroyClocks() {
        this.isoClocks.forEach(clock => {
            if (clock) {
                clock.destroy();
            }
        });
        this.isoClocks = [];

        global.dashToPanel?.panels?.forEach(panel => {
            this.getClockFromPanel(panel)?.show();
        });

        this.mainClock.show();
    }

    getIsoFormat() {
        // Setup the custom clock format based on the clock settings in Gnome Settings
        const gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");

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

        return [day, date, week, time].filter(v => v).join("   ");
    }
}

// This extenstion is based on S410's original ISO8601-ish Clock
// https://gitlab.com/S410/iso8601ish

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { ExtensionState } from "resource:///org/gnome/shell/misc/extensionUtils.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from 'gi://St';
import Clutter from 'gi://Clutter';

const DASH_TO_PANEL_UUID = "dash-to-panel@jderose9.github.com";

export default class IsoClock extends Extension {
    enable() {
        this.isoClocks = [];
        this.mainClock = this.getClockFromPanel(Main.panel)
        if (!this.mainClock) {
            console.error("No clock label? Aborting.");
            return;
        }

        this.gnomeCalendar = Gio.Settings.new("org.gnome.desktop.calendar");
        this.gnomeSettings = Gio.Settings.new("org.gnome.desktop.interface");

        this.addClockForPanel(Main.panel);

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

        // Watch for Dash to Panel's state so we can react when it is enabled or
        // disabled while our extension is running.
        this.dashToPanelSignalId = null;
        this.extensionStateHandleId = Main.extensionManager.connect(
            "extension-state-changed",
            (manager, extension) => {
                if (extension.uuid !== DASH_TO_PANEL_UUID)
                    return;

                if (extension.state === ExtensionState.ACTIVE)
                    this.onDashToPanelEnabled();
                else
                    this.onDashToPanelDisabled();
            }
        );

        // If Dash to Panel is already running, connect to it now
        const dashToPanel = Main.extensionManager.lookup(DASH_TO_PANEL_UUID);
        if (dashToPanel?.state === ExtensionState.ACTIVE)
            this.onDashToPanelEnabled();

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

        if (this.extensionStateHandleId) {
            Main.extensionManager.disconnect(this.extensionStateHandleId);
            this.extensionStateHandleId = null;
        }

        if (this.dashToPanelSignalId && global.dashToPanel) {
            global.dashToPanel.disconnect(this.dashToPanelSignalId);
        }
        this.dashToPanelSignalId = null;

        this.destroyClocks();

        this.gnomeCalendar = null
        this.gnomeSettings = null;
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

    // Create a cloned clock for the panel, hiding the original. The original
    // is stored so it can be shown again when we tear down.
    addClockForPanel(panel) {
        const original = this.getClockFromPanel(panel);
        if (!original) return;
        if (!original.get_parent()) return;

        // Don't clone the same clock twice, e.g. when Dash to Panel re-uses
        // the main panel's clock
        if (this.isoClocks.some((entry) => entry.original === original)) return;

        const clock = this.cloneClock(original);
        original.hide();
        const entry = { panel, original, clock };
        this.isoClocks.push(entry);
    }

    destroyClockEntry(entry) {
        // The clone (and original) may already have been destroyed along with
        // its panel by Dash to Panel, in which case it has no parent.
        if (entry.clock.get_parent()) {
            entry.clock.destroy();
        }

        // Show the original again if it still exists; it may have been
        // destroyed together with a standalone Dash to Panel panel
        if (entry.original.get_parent()) {
            entry.original.show();
        }
    }

    destroyClocks() {
        this.isoClocks.forEach(entry => this.destroyClockEntry(entry));
        this.isoClocks = [];
    }

    onDashToPanelEnabled() {
        if (this.dashToPanelSignalId !== null) return;
        if (!global.dashToPanel) return;

        // Dash to Panel re-creates its panels on layout changes (monitors,
        // position, orientation...), so watch for that and re-clone the clocks
        // on the new panels.
        this.dashToPanelSignalId = global.dashToPanel.connect("panels-created", () => {
            this.destroyDashToPanelClocks();
            this.createDashToPanelClocks();
            this.updateClocks();
        });

        this.createDashToPanelClocks();
        this.updateClocks();
    }

    onDashToPanelDisabled() {
        if (this.dashToPanelSignalId === null) return;

        if (global.dashToPanel) {
            global.dashToPanel.disconnect(this.dashToPanelSignalId);
        }
        this.dashToPanelSignalId = null;

        this.destroyDashToPanelClocks();
    }

    createDashToPanelClocks() {
        global.dashToPanel.panels.forEach(panel => {
            if (panel.getOrientation() === 'vertical') {
                return
            }
            this.addClockForPanel(panel);
        });
    }

    destroyDashToPanelClocks() {
        this.isoClocks = this.isoClocks.filter(entry => {
            if (entry.panel === Main.panel) return true;
            this.destroyClockEntry(entry);
            return false;
        });
    }

    updateClocks() {
        // Set our clock labels to our new custom format
        const now = GLib.DateTime.new_now_local();
        this.isoClocks.forEach(entry => {
            entry.clock.set_text(now.format(this.getIsoFormat()));
        });
    }

    getIsoFormat() {
        // Setup the custom clock format based on the clock settings in Gnome Settings
        let day, date, week, time;

        if (this.gnomeSettings.get_boolean("clock-show-weekday")) {
            day = "%A"
        }

        if (this.gnomeSettings.get_boolean("clock-show-date")) {
            date = "%Y-%m-%d";
        }

        if (this.gnomeCalendar.get_boolean("show-weekdate")) {
            week = "W%V-%u"
        }

        if (this.gnomeSettings.get_string("clock-format") === '24h') {
            time = "%H:%M";
        } else {
            time = "%I:%M %p";
        }

        if (this.gnomeSettings.get_boolean("clock-show-seconds")) {
            time = time.replace("%M","%M:%S");
        }

        return [day, date, week, time].filter(v => v).join("   ");
    }
}

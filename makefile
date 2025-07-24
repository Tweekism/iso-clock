EXTENSION_ZIP = build/iso-clock@tweekism.fairchild.au.shell-extension.zip
export SHELL_DEBUG = all

$(EXTENSION_ZIP): extension.js metadata.json
	mkdir -p build
	gnome-extensions pack --force -o build

install: $(EXTENSION_ZIP)
	gnome-extensions install --force $(EXTENSION_ZIP)

clean: 
	rm -rf build/

run: install
	dbus-run-session -- gnome-shell --nested --wayland


build/iso-clock@tweekism.fairchild.au.shell-extension.zip: extension.js metadata.json
	gnome-extensions pack --force -o build

install: build/iso-clock@tweekism.fairchild.au.shell-extension.zip
	gnome-extensions install --force build/iso-clock@tweekism.fairchild.au.shell-extension.zip 

clean: 
	rm -rf build/

run: install
	dbus-run-session -- gnome-shell --nested --wayland


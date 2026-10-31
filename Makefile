PREFIX ?= $(HOME)/.local
REF ?= main
VERSION := $(shell sed -n 's/^VERSION="\(.*\)"/\1/p' vroot)
DIST := dist/vroot-$(VERSION)

.PHONY: install uninstall test dist clean

install:
	VROOT_PREFIX="$(PREFIX)" VROOT_VERSION="$(REF)" sh ./install.sh

uninstall:
	VROOT_PREFIX="$(PREFIX)" sh ./install.sh --uninstall

test:
	bash -n vroot
	sh -n install.sh
	bash ./vroot version

dist:
	@set -eu; \
	mkdir -p "$(DIST)"; \
	for f in vroot install.sh recipes docs examples LICENSE README.md; do \
		[ -e "$$f" ] || continue; \
		cp -R "$$f" "$(DIST)/"; \
	done; \
	chmod 755 "$(DIST)/vroot" "$(DIST)/install.sh"; \
	tar -czf "$(DIST).tar.gz" -C dist "vroot-$(VERSION)"; \
	echo "$(DIST).tar.gz"

clean:
	rm -rf dist

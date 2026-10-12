.PHONY: help deps install dev build test typecheck build-image docker-run push-image \
        pmtiles-cli basemap clean

PORT      ?= 8090
IMAGE     ?= cna-flight-tracker
TAG       ?= $(shell cat VERSION)
REGISTRY  ?=
IMAGE_REF := $(if $(REGISTRY),$(REGISTRY)/,)$(IMAGE):$(TAG)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

node_modules/.bin/vitest:
	npm install

deps:
	npm install

install: ## Install dependencies
	npm ci

dev: ## Run the Vite dev server (proxies to the compose stack)
	npm run dev

build: ## Type-check and build the production bundle
	npm run build

test: node_modules/.bin/vitest ## Run unit tests
	npm test

typecheck: ## Type-check only
	npm run typecheck

build-image: ## Build the Docker image ($(IMAGE_REF))
	docker build -t $(IMAGE_REF) .

docker-run: build-image ## Build then run the image, publishing the port
	docker run --rm -p $(PORT):8080 $(IMAGE_REF)

push-image: build-image ## Build and push the image to the registry (set REGISTRY)
	@if [ -z "$(REGISTRY)" ]; then \
		echo "REGISTRY is not set. Example: make push-image REGISTRY=ghcr.io/cloud-native-airlines TAG=v0.1.0"; \
		exit 1; \
	fi
	docker push $(IMAGE_REF)

pmtiles-cli: ## Install the go-pmtiles CLI (needed to download/extract basemaps)
	go install github.com/protomaps/go-pmtiles@latest

# Self-hosted PMTiles basemap. Downloaded from a Protomaps planet build by
# extracting a bbox/zoom subset. Protomaps builds expire after ~3 months — bump
# PMTILES_BUILD to a current date (https://build.protomaps.com) if it 404s.
# Default coverage is the whole world at low zoom (global, ~43 MB).
PMTILES     	?= go-pmtiles
PMTILES_BUILD   ?= https://build.protomaps.com/20261011.pmtiles
PMTILES_BBOX    ?= -180,-85,180,85
PMTILES_MAXZOOM ?= 6
basemap: public/basemap.pmtiles ## Download public/basemap.pmtiles (coverage via PMTILES_* vars)
public/basemap.pmtiles:
	$(PMTILES) extract $(PMTILES_BUILD) $@ --bbox=$(PMTILES_BBOX) --maxzoom=$(PMTILES_MAXZOOM)

clean: ## Remove build artifacts
	rm -rf dist node_modules

.DEFAULT_GOAL := help

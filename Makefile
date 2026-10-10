.PHONY: help install dev build test typecheck build-image docker-run push-image clean

PORT      ?= 8090
IMAGE     ?= cna-flight-tracker
TAG       ?= $(shell cat VERSION)
REGISTRY  ?=
IMAGE_REF := $(if $(REGISTRY),$(REGISTRY)/,)$(IMAGE):$(TAG)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

dev: ## Run the Vite dev server (proxies to the compose stack)
	npm run dev

build: ## Type-check and build the production bundle
	npm run build

test: ## Run unit tests
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

clean: ## Remove build artifacts
	rm -rf dist node_modules

.DEFAULT_GOAL := help

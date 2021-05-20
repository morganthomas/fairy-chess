#!/usr/bin/env bash
docker load <$(nix-build docker-image.nix)

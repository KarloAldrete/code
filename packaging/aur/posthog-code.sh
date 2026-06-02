#!/bin/sh
# Wrapper on PATH. "$@" forwards the posthog-code:// URL the desktop entry
# passes via %U, plus any other CLI arguments.
exec /opt/posthog-code/'PostHog Code' "$@"

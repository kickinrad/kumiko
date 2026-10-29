#!/usr/bin/env bash
set -euo pipefail

base=$1
head=$2

changed=$(git diff --name-only "$base...$head" -- tests/expected/)
if [[ -z "$changed" ]]; then
  exit 0
fi

breaking_header='^[a-z]+(\([^)]*\))?!: '
subjects=$(git log --format=%s "$base..$head")
bodies=$(git log --format=%b "$base..$head")
if [[ ${PR_TITLE:-} =~ $breaking_header ]] || grep -Eq "$breaking_header" <<< "$subjects" || grep -Eq '^BREAKING CHANGE:' <<< "$bodies"; then
  exit 0
fi

echo 'Changes under tests/expected/ require a breaking Conventional Commit header in the PR title or a commit subject, or a BREAKING CHANGE: footer.' >&2
exit 1

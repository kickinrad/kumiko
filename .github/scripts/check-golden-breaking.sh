#!/usr/bin/env bash
set -euo pipefail

base=$1
head=$2

changed=$(git diff --name-only "$base" "$head" -- tests/expected/)
if [[ -z "$changed" ]]; then
  exit 0
fi

if [[ "${PR_TITLE:-}" == *'!'* ]] || git log --format=%B "$base..$head" | grep -Eq '!|BREAKING CHANGE'; then
  exit 0
fi

echo 'Changes under tests/expected/ require ! or BREAKING CHANGE in the PR title or a commit message.' >&2
exit 1

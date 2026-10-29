# Changelog

## [1.2.0](https://github.com/kickinrad/tokens/compare/v1.1.0...v1.2.0) (2026-10-28)


### Features

* include option for a silent base token layer ([#5](https://github.com/kickinrad/tokens/issues/5)) ([d9edb5d](https://github.com/kickinrad/tokens/commit/d9edb5de9673f5a62f031bd4fd31b5c6d5673428))

## [1.1.0](https://github.com/kickinrad/tokens/compare/tokens-v1.0.0...tokens-v1.1.0) (2026-10-19)


### Features

* tokens builder as a standalone Bun binary ([b6179c5](https://github.com/kickinrad/tokens/commit/b6179c5c3375f186f3376ce828a808f39a27fac6))


### Bug Fixes

* build token files in sorted order ([#2](https://github.com/kickinrad/tokens/issues/2)) ([6492e53](https://github.com/kickinrad/tokens/commit/6492e53749f364c72c71b16cb15fe7b10825d6f5))

**Release note:** 6492e53 also changed the frozen golden outputs under `tests/expected/`. That change should have been marked breaking and released as 2.0.0, not included in 1.1.0.

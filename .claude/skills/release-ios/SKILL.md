---
name: release-ios
description: Build and upload an iOS build to TestFlight (development-client `testflight` or standalone `beta`). Use when asked to ship to TestFlight, cut an iPhone beta, or get merged app changes onto the phone.
---

# Release iOS to TestFlight

Profiles and their backends are described in `README.md#phone-builds` and
`eas.json`. Uploading to TestFlight is outward-facing: confirm the profile and
commit with the user first.

1. Start from a clean, up-to-date `main` (or the commit the user names) that has
   passed the `verify-before-pr` gates.
2. Clear Metro's cache so stale transforms from runtime tests are not bundled:
   `rm -rf "$TMPDIR/metro-cache"`.
3. Pick the profile:

   | Goal | Command |
   | --- | --- |
   | Standalone build against production, runs without the Mac | `npm run release:ios:beta` |
   | Development client via TestFlight (loads JS from Metro) | `npm run release:ios:testflight` |
   | Development client built on EAS servers instead of this Mac | `npm run build:ios:cloud` |

   `release:*` runs `build:ios:*` (local `eas build --local`, needs Xcode) then
   `submit:ios:*`. Rerun only the failing half if one step fails; the `.ipa`
   lands in `build/`.
4. EAS increments the build number (`appVersionSource: remote`). The first
   submit for a new bundle ID asks the user for their Apple ID; do not enter
   credentials yourself.
5. Publish the build's source (GPL): `npm run source:publish -- <commit>
   ios-build-<number>` (`README.md#phone-builds`).
6. Record in `docs/status.md` which merged work is now in a TestFlight build,
   and which device checks remain.

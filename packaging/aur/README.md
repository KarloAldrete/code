# AUR packaging (`posthog-code-bin`)

Source of truth for the [`posthog-code-bin`](https://aur.archlinux.org/packages/posthog-code-bin)
AUR package. The package repackages the prebuilt Linux zip from each GitHub
release into the standard Arch filesystem layout.

Installing it (`paru -S posthog-code-bin`) also registers the `posthog-code://`
deep-link scheme system-wide: the bundled `posthog-code.desktop` declares
`MimeType=x-scheme-handler/posthog-code;`, and pacman's `desktop-file-utils` hook
runs `update-desktop-database` on install — so the browser can launch the app
after login without any runtime registration.

## Files

| File                   | Purpose                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `PKGBUILD`             | Build recipe. `pkgver` is rewritten per release by CI.        |
| `posthog-code.sh`      | `/usr/bin/posthog-code` launcher (wraps the spaced exec name). |
| `posthog-code.desktop` | Menu entry + `posthog-code://` scheme handler.                |

## Automated publishing

`.github/workflows/aur-publish.yml` runs on `release: published` (and via manual
`workflow_dispatch`). It bumps `pkgver`, recomputes `sha256sums*` with
`updpkgsums`, regenerates `.SRCINFO`, and pushes to the AUR. It needs the
`AUR_SSH_PRIVATE_KEY` repo secret (private key whose public half is on the
project's AUR account).

## One-time AUR setup

1. Create/confirm an org-owned account at https://aur.archlinux.org and add an
   SSH public key.
2. Add the matching private key as the `AUR_SSH_PRIVATE_KEY` GitHub secret.
3. Reserve the name with an initial push (or a first `workflow_dispatch` run):
   ```sh
   git clone ssh://aur@aur.archlinux.org/posthog-code-bin.git
   ```

## Local test loop (Arch box or `archlinux:latest` container)

```sh
# from a copy of this dir with pkgver set to a real released version
updpkgsums
makepkg --printsrcinfo > .SRCINFO
makepkg -si
namcap PKGBUILD ./*.pkg.tar.zst        # tune depends / fix warnings

# verify the scheme handler + launch
xdg-mime query default x-scheme-handler/posthog-code   # -> posthog-code.desktop
posthog-code "posthog-code://inbox/test-123"
```

### First-build note

The `package()` step assumes electron-forge's zip extracts to
`PostHog Code-linux-<arch>/` with `chrome-sandbox` at its root and the icon at
`resources/app-icon.png`. Confirm this on the first real build and adjust the
paths if forge's layout changes.

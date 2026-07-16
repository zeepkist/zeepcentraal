---
title: Setup Modkist and GTR
description: Install Zeepkist's mod manager and enable ZeepCentraal record submission and ghost tools.
editPath: wiki/setup-modkist.md
---

Modkist is an easy-to-use mod manager for Zeepkist on Windows, Steam Deck, and Linux. It uses the mod.io platform for uploading and approving mods. Mods are verified by core Zeepkist mod developers before distribution, and Modkist keeps installed mods updated when you launch it.

Modkist also provides Blueprints that can be imported into the Zeepkist Level Editor with [BlueprintsX](/mod/blueprintsx).

::content-alert{type="notice" title="You stay in control"}
Modkist lists installed mods in one place. You can update, install, or remove GTR without reinstalling Zeepkist.
::

## Download Modkist

::content-alert{type="reminder" title="Install safely"}
Zeepkist **must not be running** when you open Modkist to install or update mods. Download releases only through the links below or on the official GitHub source repository.
::

::content-modkist-downloads
::

### Windows

1. Close Zeepkist.
2. Download the Windows MSI installer above.
3. Open the installer and review its prompts.
4. Start Modkist and let it locate your Zeepkist installation.
5. If automatic detection fails, select the Zeepkist installation directory manually.

### Linux and Steam Deck

Use the AppImage for a portable installation or the DEB package on compatible Debian-based distributions. On Steam Deck, switch to Desktop Mode for installation and configuration.

1. Close Zeepkist.
2. Download the AppImage or DEB package above.
3. Make the AppImage executable when required by your desktop environment.
4. Start Modkist and select the Zeepkist installation directory.
5. Return to Gaming Mode after Modkist and your mods are configured.

The DMG release asset is also available for macOS users who need it.

## Install GTR

[GTR](/mod/zeepkist-gtr) submits completed runs to ZeepCentraal and provides Personal Best and World Record ghost replays, including bulk ghost playback for studying how leading players approach a level.

1. Open Modkist.
2. Find [**Zeepkist GTR**](/mod/zeepkist-gtr) in the mod browser.
3. Install the GTR mod.
4. Launch Zeepkist in Modkist or through your normal Steam library.

You can review GTR on its [official mod.io page](https://mod.io/g/zeepkist/m/zeepkist-gtr).

::content-alert{type="reminder" title="Keep mods up-to-date"}
Launch Modkist regularly so it can update installed mods. GTR may require
updates to continue submitting records to ZeepCentraal.
::

### Confirm record submission

Finish a level while GTR is enabled. Your run should appear on [your recent records page](/records/me).

## Zeeper for Linux and Steam Deck

[Zeeper](https://crates.io/crates/zeeper) is a command-line Zeepkist mod manager for Linux and Steam Deck. It has no graphical interface, making it useful for players who prefer terminal-based installation and updates.

Install Zeeper through Rust's Cargo package manager:

```bash
cargo install zeeper
```

Inspect available commands and options:

```bash
zeeper --help
```

Typical setup uses Zeeper to install BepInEx, authenticate with mod.io, install mods, inspect installed mods, check updates, and apply updates. Review command-specific options before changing your installation:

```bash
zeeper install-bepinex --help
zeeper login --help
zeeper install --help
zeeper list --help
zeeper check --help
zeeper update --help
```

Use the Linux setup options documented by Zeeper for native Steam installations. Steam Deck Flatpak installations may require its Flatpak-specific option.

## Troubleshooting

- Update GTR if it fails to sign-in on the Zeepkist Main Menu, as from time to time, certain updates to ZeepCentraal may require mandatory updates to GTR to continue submitting records.

Need more help? Join the [Zeepkist modding Discord](https://discord.gg/zEeHqdPQWQ).

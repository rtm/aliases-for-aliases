# Aliases for Aliases

An [Obsidian](https://obsidian.md) plugin that lets you define **named alias groups** in frontmatter using properties of the form `aliases:<namespace>`. These aliases work just like built-in Obsidian aliases: they resolve `[[wikilinks]]` and appear as suggestions in the `[[` autocomplete popup.

## Why?

Obsidian's built-in `aliases` property is a flat list. There's no way to record *why* a particular alias exists — is it a synonym, a translation, an abbreviation, a former name?

This plugin lets you use namespaced alias properties:

```yaml
aliases:japanese:
  - おわる
  - 終わる
aliases:spanish:
  - terminar
```

Each `aliases:*` property is treated as an additional alias group for that note.

## Usage

Add any frontmatter property whose name starts with `aliases:` to a note:

```yaml
---
aliases:japanese:
  - おわる
  - 終わる
---
```

Now `[[おわる]]` resolves to that note, and typing `[[おわ` in the editor shows it as a suggestion with the alias text and filename displayed — exactly like a built-in alias.

- Values can be a list (recommended) or a single string.
- Multiple `aliases:*` properties are all active simultaneously.
- Changes take effect immediately on save — no manual refresh needed.

## Installation

### From the community plugin directory

Search for **Aliases for Aliases** in Settings → Community plugins.

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/rtm/aliases-for-aliases/releases).
2. Copy them to `<vault>/.obsidian/plugins/aliases-for-aliases/`.
3. Enable the plugin in Settings → Community plugins.

## Commands

- **Refresh Custom Aliases** — rebuilds the alias index from all vault files (normally not needed).
- **Debug: Dump Alias Map to Console** — logs all registered custom aliases to the developer console.

## Notes

- Property names like `aliases:japanese` are automatically registered as list-type fields in Obsidian's property system, so the UI always shows them as lists.
- The namespace after the colon (e.g. `japanese`, `spanish`) is purely for your own organization — the plugin treats all `aliases:*` properties equally.
- Standard `aliases` property behavior is unaffected.

## License

MIT

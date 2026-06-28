# Security Policy

## Supported Versions

Security fixes are provided for the latest released version of Kotonoha.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories for this repository:

https://github.com/Rons-29/kotonoha/security/advisories/new

If GitHub Security Advisories are unavailable, open a minimal public issue that says you have a security report, without including exploit details.

## Notes

- It stores notes, settings, and attachments inside the user's vault.
- It treats vault Markdown as user-owned content.
- It does not try to sanitize or block normal Markdown links, embeds, or Obsidian rendering behavior.

## Hardening

Kotonoha limits URL-scheme capture length, memo length, attachment count, attachment size, and sanitizes vault-relative folders to avoid accidental path traversal components.

# FANY Talent Capture

Chrome extension for collecting creator profile data from TikTok, Instagram, YouTube, NoxInfluencer, and FastMoss into the FANY talent database.

## Latest Version

- Extension version: `0.4.20`
- Install package: `dist/fany-talent-capture-0.4.20.zip`

## Install From ZIP

1. Download `dist/fany-talent-capture-0.4.20.zip`.
2. Unzip it.
3. Open Chrome and go to `chrome://extensions/`.
4. Turn on Developer Mode.
5. Click "Load unpacked".
6. Select the unzipped `talent-capture` folder.
7. Open extension settings and fill in the endpoint and your personal member token.

## Update From Git Clone

If you installed the extension from a cloned repo folder:

```bash
git pull
```

Then open `chrome://extensions/` and click "Reload" on the extension card.

## Endpoint

Use the endpoint provided by the admin. For local testing on the admin machine:

```text
http://127.0.0.1:8791/api/talents/upsert
```

## Notes

This repository intentionally excludes server secrets, `.env`, member token lists, logs, and backend runtime files.

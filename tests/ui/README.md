# UI test page

Static mobile layout fixture for Kotonoha. Used by `ui:serve`, `ui:check`, and `ui:preview`.

## Manual serve

```bash
npm run ui:serve
```

Open the printed URL (`http://127.0.0.1:8094/tests/ui/kotonoha-mobile.html`).

## Layout check

```bash
npm run ui:check
```

Captures a screenshot when Chrome/Chromium is available. Without a browser, prints the serve URL for manual inspection.

## Artifact Share preview loop

Local annotation preview via [@artifactshare/cli](https://www.npmjs.com/package/@artifactshare/cli). No sign-in or upload required.

Requires Node.js **22.19+**.

### Human: start preview

```bash
npm run ui:preview
```

The CLI prints a JSON line with `url` and opens the browser (pass `--no-open` to skip). In comment mode, click elements, write notes, and submit a batch with **Request fixes**.

Saving `tests/ui/kotonoha-mobile.html` or `styles.css` reloads the page automatically.

Stop with Ctrl+C or:

```bash
npm exec --yes --package=@artifactshare/cli -- artifactshare preview stop ./tests/ui/kotonoha-mobile.html
```

### Agent: wait, edit, report

While preview is running, poll for submitted batches:

```bash
npm exec --yes --package=@artifactshare/cli -- artifactshare preview next ./tests/ui/kotonoha-mobile.html --wait 90 --json
```

- `timed_out: true` — no batch yet; run `preview next` again.
- `session_ended: true` — preview stopped; ask the human to restart `npm run ui:preview`.

Apply edits to the HTML/CSS, then report outcomes:

```bash
printf '%s' '{"items":[{"thread":"<id>","generation":1,"outcome":"fixed","note":"..."}]}' \
  | npm exec --yes --package=@artifactshare/cli -- artifactshare preview done ./tests/ui/kotonoha-mobile.html --stdin --json
```

Use `"outcome":"skipped"` when intentionally not fixing a comment. Repeat `next` → edit → `done` until the review is finished.

---

## ローカルプレビューループ（Artifact Share）

[@artifactshare/cli](https://www.npmjs.com/package/@artifactshare/cli) で、ブラウザ上のクリックコメントからエージェント修正へつなぐループです。ログインやアップロードは不要です。

Node.js **22.19 以降**が必要です。

### 人間: プレビュー開始

```bash
npm run ui:preview
```

JSON 行に `url` が出力され、ブラウザが開きます（`--no-open` で自動起動を省略）。コメントモードで要素をクリックし、メモを書いて **修正を依頼する** でバッチ送信します。

`tests/ui/kotonoha-mobile.html` や `styles.css` を保存するとページが自動リロードされます。

終了は Ctrl+C、または:

```bash
npm exec --yes --package=@artifactshare/cli -- artifactshare preview stop ./tests/ui/kotonoha-mobile.html
```

### エージェント: 待機・修正・報告

プレビュー実行中にバッチを取得:

```bash
npm exec --yes --package=@artifactshare/cli -- artifactshare preview next ./tests/ui/kotonoha-mobile.html --wait 90 --json
```

- `timed_out: true` — まだ送信なし。`preview next` を再実行。
- `session_ended: true` — プレビュー終了。人間に `npm run ui:preview` の再起動を依頼。

HTML/CSS を修正したら結果を報告:

```bash
printf '%s' '{"items":[{"thread":"<id>","generation":1,"outcome":"fixed","note":"..."}]}' \
  | npm exec --yes --package=@artifactshare/cli -- artifactshare preview done ./tests/ui/kotonoha-mobile.html --stdin --json
```

修正しない場合は `"outcome":"skipped"`。`next` → 編集 → `done` を繰り返します。

## 参考文献

- [Artifact Share CLI（npm）](https://www.npmjs.com/package/@artifactshare/cli)
- [Artifact Share CLI reference](https://artifactshare.com/guides/cli)

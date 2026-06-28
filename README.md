# Kotonoha

Kotonoha is an Obsidian plugin for saving short notes and tasks to Daily Notes, then reviewing them in a simple timeline.

The name comes from the Japanese word `言の葉` (`kotonoha`), an older expression for words or language.

## Features

- Append notes to Daily Notes
- Save tasks and toggle completion
- Review notes in a timeline
- Search by text, tags, and date range
- Use a heatmap and random review
- Save file attachments

## Install

After Kotonoha is listed in Community Plugins, search for `Kotonoha` in Obsidian settings and install it.

To install manually, download these files from the latest release and place them in `.obsidian/plugins/kotonoha/` in your vault:

- `main.js`
- `manifest.json`
- `styles.css`

Reload Obsidian, then enable Kotonoha from Community Plugins.

## Usage

1. Open Kotonoha.
2. Write a note in the input area.
3. Press `残す` to save it.

Turn on `タスク` before saving to create an open task. You can also start the text with `[ ]` or `[x]`.

## Daily Notes

By default, Kotonoha appends notes to today's Daily Note. If today's Daily Note does not exist, Kotonoha creates it using your Daily Notes settings and template before saving.

You can change the destination heading in settings. The default heading is `つぶやき`.

```markdown
## つぶやき
- 18:30 Finished today's notes #work
  %% kotonoha:id=... %%
- [ ] 18:35 Review tomorrow's document
  %% kotonoha:id=... %%
```

## 日本語

Kotonohaは、短いメモやタスクをDaily Notesへすばやく保存し、あとからタイムラインで見返すためのプラグインです。

## Features

- Daily Notesへのメモ追記
- タスク保存と完了切替
- タイムライン表示
- 検索、タグ、期間フィルタ
- ヒートマップとランダム回顧
- 添付ファイル保存

## Install

Community Plugins掲載後は、Obsidianの設定から `Kotonoha` を検索してインストールできます。

手動で試す場合は、リリースに含まれる次のファイルをVaultの `.obsidian/plugins/kotonoha/` に置きます。

- `main.js`
- `manifest.json`
- `styles.css`

その後、Obsidianを再読み込みしてCommunity PluginsからKotonohaを有効にします。

## Usage

1. Kotonohaを開く
2. 下部の入力欄にメモを書く
3. `残す` を押す

`タスク` をオンにして保存すると、未完了タスクとして保存されます。本文を `[ ]` または `[x]` から始める方法も使えます。

## Daily Notes

初期設定では、今日のDaily Noteにメモを追記します。今日のDaily Noteがまだない場合は、ObsidianのDaily Notes設定とテンプレートを使って作成してから保存します。

保存先の見出しは設定から変更できます。初期値は `つぶやき` です。

```markdown
## つぶやき
- 18:30 今日やったこと #work
  %% kotonoha:id=... %%
- [ ] 18:35 明日の資料を確認する
  %% kotonoha:id=... %%
```

## Development

開発、テスト、リリース手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

MIT License. See [LICENSE](LICENSE).

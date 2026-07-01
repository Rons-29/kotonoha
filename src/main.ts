import {
	App,
	ItemView,
	MarkdownRenderer,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	moment,
	normalizePath
} from "obsidian";

const VIEW_TYPE_LOCAL_THINO = "kotonoha-view";
const META_RE = /\s*%%\s*kotonoha:([^%]*)%%\s*/g;
const META_LINE_RE = /^\s*%%\s*kotonoha:([^%]*)%%\s*$/;
const MAX_MEMO_CONTENT_LENGTH = 20000;
const MAX_PROTOCOL_CONTENT_LENGTH = 10000;
const MAX_ATTACHMENT_FILES = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type KotonohaSettings = {
	language: KotonohaLanguageSetting;
	memoFolder: string;
	dailyNoteFolder: string;
	dailyNoteFileFormat: string;
	dateFormat: string;
	timeFormat: string;
	captureToDailyNote: boolean;
	dailyHeading: string;
	insertNewMemoAtTop: boolean;
	dailyGoal: number;
	randomReviewCount: number;
	heatmapDays: number;
	showAdvancedControls: boolean;
	attachmentFolder: string;
	saveButtonLabel: string;
	draftContent: string;
	draftTaskCapture: boolean;
	draftSaveTarget: SaveTarget;
};

type MemoStatus = "active" | "archived" | "deleted";
type StatusFilter = "active" | "all" | "archived" | "deleted";
type DateFilter = "all" | "today" | "week" | "month" | "custom";
type TaskFilter = "all" | "memo" | "open" | "done";
type TaskStatus = "none" | "open" | "done";
type SaveTarget = "default" | "daily" | "monthly";
type ViewLayout = "list" | "compact" | "grid";
type ReviewMode = "random" | "today" | "sevenDaysAgo";
type KotonohaLanguageSetting = "auto" | "ja" | "en";
type KotonohaLanguage = "ja" | "en";
type DailyNotesSettings = { folder?: string; format?: string; template?: string };
type AttachmentSaveResult = { links: string[]; paths: string[] };
type CaptureResult = { path: string; target: "daily" | "monthly" };
type LoadedSettings = Partial<Record<keyof KotonohaSettings, unknown>>;

type MemoItem = {
	id: string;
	storageId: string | null;
	filePath: string;
	startLine: number;
	endLine: number;
	timestampText: string;
	createdAt: string;
	createdTime: number;
	content: string;
	tags: string[];
	status: MemoStatus;
	pinned: boolean;
	taskStatus: TaskStatus;
};

const DEFAULT_SETTINGS: KotonohaSettings = {
	language: "auto",
	memoFolder: "Kotonoha",
	dailyNoteFolder: "",
	dailyNoteFileFormat: "YYYY-MM-DD",
	dateFormat: "YYYY-MM-DD",
	timeFormat: "HH:mm",
	captureToDailyNote: true,
	dailyHeading: "つぶやき",
	insertNewMemoAtTop: false,
	dailyGoal: 5,
	randomReviewCount: 10,
	heatmapDays: 42,
	showAdvancedControls: false,
	attachmentFolder: "Kotonoha/attachments",
	saveButtonLabel: "残す",
	draftContent: "",
	draftTaskCapture: false,
	draftSaveTarget: "default",
};

const TRANSLATIONS = {
	ja: {
		openKotonoha: "Kotonoha を開く",
		openTimelineCommand: "メモタイムラインを開く",
		captureSelectionCommand: "選択範囲をメモタイムラインに保存",
		randomReviewCommand: "ふりかえりを表示",
		cleanMetadataCommand: "Daily Note上のKotonoha内部IDを非表示にする",
		noSelection: "選択中のテキストがありません。",
		emptyMemo: "メモが空です。",
		memoTooLong: "メモが長すぎます。{count}文字以内にしてください。",
		saveFailed: "保存できませんでした: {message}",
		saveFailedGeneric: "保存できませんでした。",
		savedDaily: "今日のDaily Noteに残しました。",
		savedMonthly: "Kotonohaに残しました。",
		protocolEmpty: "URL から保存するメモ本文がありません。",
		protocolTooLong: "URL から保存できる本文は{count}文字までです。",
		attachmentTooMany: "添付できるファイルは一度に{count}個までです。",
		attachmentTooLarge: "添付ファイルは1つ{mb}MBまでです。",
		attachmentSaveFailed: "添付を保存できませんでした: {message}",
		attachmentSaveFailedGeneric: "添付を保存できませんでした。",
		titleSubtitle: "日々の言葉をDaily Notesへ",
		search: "検索",
		status: "状態",
		normal: "通常",
		all: "すべて",
		archive: "アーカイブ",
		trash: "ゴミ箱",
		period: "期間",
		allPeriod: "全期間",
		today: "今日",
		sevenDays: "7日",
		thirtyDays: "30日",
		type: "種類",
		memoAndTask: "メモ+タスク",
		memoOnly: "メモのみ",
		openTask: "未完了",
		doneTask: "完了",
		display: "表示",
		detailList: "詳細リスト",
		compact: "圧縮",
		cardGrid: "カードグリッド",
		placeholder: "いま残したいことを書く。[ ] で未完了、[x] で完了。",
		task: "タスク",
		attach: "添付",
		attachCount: "添付 {count}",
		save: "残す",
		saveTarget: "保存先",
		defaultTarget: "設定通り",
		dailyTarget: "日次",
		monthlyTarget: "月次",
		targetLine: "保存先: {target} / {heading}",
		targetDaily: "今日のDaily Note",
		targetMonthly: "月次メモ",
		reflect: "ふりかえり",
		reflectRandom: "ランダム",
		reflectToday: "今日",
		reflectSevenDaysAgo: "7日前",
		reload: "再読み込み",
		hint: "タスク: 未完了タスクとして保存 / 添付: vault に保存してリンク追加 / Cmd/Ctrl+Enter: 保存",
		noReviewMemos: "表示できるメモがありません。",
		emptyNoMemos: "まだ言の葉はありません。今日のひとことを残してみましょう。",
		emptyFiltered: "この条件に合う言の葉はありません。",
		activeCount: "通常 {count}",
		todayCount: "今日 {count}",
		archiveCount: "アーカイブ {count}",
		openTaskCount: "未完了 {count}",
		trashCount: "ゴミ箱 {count}",
		customDateChip: "{date} のメモ",
		randomReviewChip: "ふりかえり {count}件",
		tagChip: "タグ {tag}",
		clear: "解除",
		dailyProgress: "今日の進捗 {count}/{goal}",
		heatmapTitle: "{date}: {count}件",
		pinnedPrefix: "固定 / ",
		backToOpen: "未完了に戻す",
		completeTask: "タスク完了",
		more: "…",
		close: "閉じる",
		edit: "編集",
		unpin: "ピン解除",
		pin: "ピン留め",
		taskify: "タスク化",
		untask: "タスク解除",
		openNote: "ノートを開く",
		cancel: "キャンセル",
		restore: "復元",
		deletePermanently: "完全削除",
		undo: "元に戻す",
		undone: "元に戻しました。",
		undoFailed: "元に戻せませんでした。",
		memoUpdated: "メモを更新しました。",
		archivedNotice: "アーカイブしました。",
		trashedNotice: "ゴミ箱に移動しました。",
		restoredNotice: "復元しました。",
		pinnedNotice: "ピン留めしました。",
		unpinnedNotice: "ピン留めを解除しました。",
		taskDoneNotice: "タスクを完了にしました。",
		taskOpenNotice: "タスクを未完了にしました。",
		taskNoneNotice: "タスク扱いを解除しました。",
		safeTargetError: "対象のメモを安全に特定できませんでした。再読み込みしてから試してください。",
		deletedPermanentlyNotice: "メモを完全に削除しました。",
		deleteFailed: "メモを削除できませんでした。",
		updateFailed: "メモを更新できませんでした。",
		undoTargetMissing: "Undo対象のメモが見つかりません。",
		cleanedMetadata: "Kotonohaの内部IDを整理しました。",
		noMetadataToClean: "整理できるKotonohaの内部IDはありません。",
		cleanMetadataFailed: "内部IDを整理できませんでした。",
		settingsLead: "アイデア、タスク、短い記録をすばやく保存して管理します。",
		settingsHero: "言の葉を日々のノートに残し、検索、タグ、ふりかえりで見返せます。",
		openMemo: "メモを開く",
		languageSetting: "表示言語",
		languageSettingDesc: "Kotonoha の表示言語です。自動では Obsidian の表示言語に合わせます。",
		languageAuto: "自動",
		languageJapanese: "日本語",
		languageEnglish: "English",
		featuresHeading: "機能",
		basicFeature: "基本",
		basicFeatureDesc: "メモの保存、編集、削除、復元",
		saveFeature: "保存",
		saveFeatureDesc: "保存先フォルダ、日次形式、見出し",
		displayFeature: "表示",
		displayFeatureDesc: "検索、タグ、期間、状態フィルタ",
		editorFeature: "エディタ",
		editorFeatureDesc: "選択範囲保存、複数行メモ",
		reflectFeature: "ふりかえり",
		reflectFeatureDesc: "ヒートマップ、ランダム表示、日次目標",
		attachmentFeature: "添付",
		attachmentFeatureDesc: "ファイル保存、リンク追加",
		saveSettings: "保存設定",
		captureToDailyNote: "デイリーノートに保存",
		captureToDailyNoteDesc: "有効にすると、指定したデイリーノートファイルの見出し下にメモを追加します。",
		dailyNoteFolder: "デイリーノート保存先フォルダ",
		dailyNoteFolderDesc: "Obsidian のデイリーノート設定がある場合はそちらを優先します。未設定時の fallback です。",
		dailyNoteFileName: "デイリーノートのファイル名",
		dailyNoteFileNameDesc: "Obsidian のデイリーノート設定がある場合はそちらを優先します。Moment.js 形式です。",
		dailyHeading: "日次ノートの見出し",
		dailyHeadingDesc: "# や ## は入力不要です。この見出しの下にメモを追加します。",
		insertNewMemoAtTop: "新しいメモを上に追加",
		insertNewMemoAtTopDesc: "有効にすると、見出しの直下に最新メモを追加します。無効の場合は末尾に追加します。",
		monthlyFolder: "月次保存フォルダ",
		monthlyFolderDesc: "デイリーノート保存を無効にした場合に使う、vault 内の相対フォルダです。",
		attachmentFolder: "添付ファイル保存フォルダ",
		attachmentFolderDesc: "Kotonoha から添付したファイルを保存する vault 内の相対フォルダです。",
		saveButtonLabel: "保存ボタンの表示名",
		saveButtonLabelDesc: "下部入力欄の主ボタンに表示する短い言葉です。空欄にすると表示言語に合わせます。",
		displaySettings: "表示設定",
		showAdvancedControls: "詳細ツールを表示",
		showAdvancedControlsDesc: "検索、絞り込み、統計、ヒートマップ、タグをタイムライン上部に表示します。無効時は書きやすさを優先します。",
		reflectSettings: "ふりかえり設定",
		dailyGoal: "1日の目標メモ数",
		dailyGoalDesc: "今日の進捗バーに使います。",
		randomReviewCount: "ふりかえりの件数",
		randomReviewCountDesc: "ランダム表示で選ぶメモ数です。",
		heatmapDays: "ヒートマップの日数",
		heatmapDaysDesc: "タイムライン上部に表示する日数です。",
		deleteModalTitle: "メモを完全に削除しますか？",
		deleteModalDesc: "この操作は対象のメモ本文をノートから削除します。",
		deleteAction: "削除",
		yesterday: "昨日",
	},
	en: {
		openKotonoha: "Open Kotonoha",
		openTimelineCommand: "Open memo timeline",
		captureSelectionCommand: "Save selection to memo timeline",
		randomReviewCommand: "Show reflection",
		cleanMetadataCommand: "Hide Kotonoha internal IDs in Daily Notes",
		noSelection: "No selected text.",
		emptyMemo: "Memo is empty.",
		memoTooLong: "Memo is too long. Keep it within {count} characters.",
		saveFailed: "Could not save: {message}",
		saveFailedGeneric: "Could not save.",
		savedDaily: "Saved to today's Daily Note.",
		savedMonthly: "Saved to Kotonoha.",
		protocolEmpty: "No memo text was provided from the URL.",
		protocolTooLong: "URL capture text must be within {count} characters.",
		attachmentTooMany: "You can attach up to {count} files at once.",
		attachmentTooLarge: "Each attachment must be {mb}MB or smaller.",
		attachmentSaveFailed: "Could not save attachments: {message}",
		attachmentSaveFailedGeneric: "Could not save attachments.",
		titleSubtitle: "Everyday words in Daily Notes",
		search: "Search",
		status: "Status",
		normal: "Normal",
		all: "All",
		archive: "Archive",
		trash: "Trash",
		period: "Period",
		allPeriod: "All time",
		today: "Today",
		sevenDays: "7 days",
		thirtyDays: "30 days",
		type: "Type",
		memoAndTask: "Notes + tasks",
		memoOnly: "Notes only",
		openTask: "Open",
		doneTask: "Done",
		display: "View",
		detailList: "Detailed list",
		compact: "Compact",
		cardGrid: "Card grid",
		placeholder: "Write what you want to keep. Use [ ] for tasks and [x] for done.",
		task: "Task",
		attach: "Attach",
		attachCount: "Attach {count}",
		save: "Save",
		saveTarget: "Target",
		defaultTarget: "Default",
		dailyTarget: "Daily",
		monthlyTarget: "Monthly",
		targetLine: "Target: {target} / {heading}",
		targetDaily: "Today's Daily Note",
		targetMonthly: "Monthly note",
		reflect: "Reflect",
		reflectRandom: "Random",
		reflectToday: "Today",
		reflectSevenDaysAgo: "7 days ago",
		reload: "Reload",
		hint: "Task: save as an open task / Attach: save to the vault and add links / Cmd/Ctrl+Enter: save",
		noReviewMemos: "No memos to show.",
		emptyNoMemos: "No words saved yet. Capture a thought for today.",
		emptyFiltered: "No notes match these filters.",
		activeCount: "Normal {count}",
		todayCount: "Today {count}",
		archiveCount: "Archived {count}",
		openTaskCount: "Open {count}",
		trashCount: "Trash {count}",
		customDateChip: "Notes from {date}",
		randomReviewChip: "Reflecting on {count}",
		tagChip: "Tag {tag}",
		clear: "Clear",
		dailyProgress: "Today's progress {count}/{goal}",
		heatmapTitle: "{date}: {count}",
		pinnedPrefix: "Pinned / ",
		backToOpen: "Mark open",
		completeTask: "Complete task",
		more: "…",
		close: "Close",
		edit: "Edit",
		unpin: "Unpin",
		pin: "Pin",
		taskify: "Make task",
		untask: "Remove task",
		openNote: "Open note",
		cancel: "Cancel",
		restore: "Restore",
		deletePermanently: "Delete permanently",
		undo: "Undo",
		undone: "Undone.",
		undoFailed: "Could not undo.",
		memoUpdated: "Memo updated.",
		archivedNotice: "Archived.",
		trashedNotice: "Moved to trash.",
		restoredNotice: "Restored.",
		pinnedNotice: "Pinned.",
		unpinnedNotice: "Unpinned.",
		taskDoneNotice: "Task completed.",
		taskOpenNotice: "Task reopened.",
		taskNoneNotice: "Removed task status.",
		safeTargetError: "Could not safely identify the target memo. Reload and try again.",
		deletedPermanentlyNotice: "Memo deleted permanently.",
		deleteFailed: "Could not delete memo.",
		updateFailed: "Could not update memo.",
		undoTargetMissing: "Undo target memo was not found.",
		cleanedMetadata: "Kotonoha internal IDs were cleaned up.",
		noMetadataToClean: "No Kotonoha internal IDs to clean up.",
		cleanMetadataFailed: "Could not clean up internal IDs.",
		settingsLead: "Quickly save and manage ideas, tasks, and short notes.",
		settingsHero: "Save everyday words to Daily Notes, then review them with search, tags, and reflections.",
		openMemo: "Open memo",
		languageSetting: "Display language",
		languageSettingDesc: "Language used by Kotonoha. Auto follows Obsidian's display language.",
		languageAuto: "Auto",
		languageJapanese: "Japanese",
		languageEnglish: "English",
		featuresHeading: "Features",
		basicFeature: "Basics",
		basicFeatureDesc: "Save, edit, delete, and restore memos",
		saveFeature: "Saving",
		saveFeatureDesc: "Folders, Daily Note format, and headings",
		displayFeature: "Display",
		displayFeatureDesc: "Search, tags, date, and status filters",
		editorFeature: "Editor",
		editorFeatureDesc: "Selection capture and multiline memos",
		reflectFeature: "Reflect",
		reflectFeatureDesc: "Heatmap, random picks, and daily goal",
		attachmentFeature: "Attachments",
		attachmentFeatureDesc: "File saving and link insertion",
		saveSettings: "Saving",
		captureToDailyNote: "Save to Daily Notes",
		captureToDailyNoteDesc: "When enabled, add memos under the configured heading in the Daily Note.",
		dailyNoteFolder: "Daily Note folder",
		dailyNoteFolderDesc: "Kotonoha uses Obsidian's Daily Notes settings when available. This is the fallback folder.",
		dailyNoteFileName: "Daily Note file name",
		dailyNoteFileNameDesc: "Kotonoha uses Obsidian's Daily Notes settings when available. Uses Moment.js format.",
		dailyHeading: "Daily Note heading",
		dailyHeadingDesc: "Do not include # or ##. Memos are added under this heading.",
		insertNewMemoAtTop: "Add new memos at the top",
		insertNewMemoAtTopDesc: "When enabled, new memos are inserted directly under the heading. Otherwise they are appended at the end.",
		monthlyFolder: "Monthly memo folder",
		monthlyFolderDesc: "Vault-relative folder used when Daily Note saving is disabled.",
		attachmentFolder: "Attachment folder",
		attachmentFolderDesc: "Vault-relative folder for files attached from Kotonoha.",
		saveButtonLabel: "Save button label",
		saveButtonLabelDesc: "Short label for the primary button in the bottom input. Leave empty to follow the display language.",
		displaySettings: "Display",
		showAdvancedControls: "Show advanced tools",
		showAdvancedControlsDesc: "Show search, filters, stats, heatmap, and tags above the timeline. Disable this to prioritize writing.",
		reflectSettings: "Reflection",
		dailyGoal: "Daily memo goal",
		dailyGoalDesc: "Used by today's progress bar.",
		randomReviewCount: "Reflection count",
		randomReviewCountDesc: "Number of memos selected for random reflection.",
		heatmapDays: "Heatmap days",
		heatmapDaysDesc: "Number of days shown above the timeline.",
		deleteModalTitle: "Delete this memo permanently?",
		deleteModalDesc: "This removes the memo text from the note.",
		deleteAction: "Delete",
		yesterday: "Yesterday",
	},
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.ja;

export default class KotonohaPlugin extends Plugin {
	settings: KotonohaSettings = DEFAULT_SETTINGS;
	dailyNotesSettings: DailyNotesSettings | null = null;

	async onload() {
		await this.loadSettings();
		this.dailyNotesSettings = await loadCoreDailyNotesSettings(this.app);

		this.registerView(
			VIEW_TYPE_LOCAL_THINO,
			(leaf) => new KotonohaView(leaf, this)
		);

		this.addRibbonIcon("message-square-plus", this.t("openKotonoha"), () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open",
			name: this.t("openTimelineCommand"),
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "capture-selection",
			name: this.t("captureSelectionCommand"),
			editorCallback: async (editor) => {
				const selected = editor.getSelection().trim();
				if (!selected) {
					new Notice(this.t("noSelection"));
					return;
				}
				await this.captureMemo(selected);
			},
		});

		this.addCommand({
			id: "random-review",
			name: this.t("randomReviewCommand"),
			callback: () => {
				void (async () => {
					await this.activateView();
					this.getOpenViews().forEach((view) => view.pickRandomMemo());
				})();
			},
		});

		this.addCommand({
			id: "clean-visible-metadata",
			name: this.t("cleanMetadataCommand"),
			callback: () => {
				void this.cleanVisibleMetadata();
			},
		});

		this.registerObsidianProtocolHandler("kotonoha", (params) => {
			void this.handleProtocolCapture(params);
		});

		this.addSettingTab(new KotonohaSettingTab(this.app, this));
	}

	async activateView() {
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_LOCAL_THINO)
			.forEach((existingLeaf) => existingLeaf.detach());

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_LOCAL_THINO, active: true });
	}

	async loadSettings() {
		const loaded = asLoadedSettings(await this.loadData());
		this.settings = {
			memoFolder: normalizeFolder(getStringSetting(loaded, "memoFolder", DEFAULT_SETTINGS.memoFolder)),
			language: normalizeLanguageSetting(getOptionalStringSetting(loaded, "language")),
			dailyNoteFolder: normalizeOptionalFolder(getStringSetting(loaded, "dailyNoteFolder", DEFAULT_SETTINGS.dailyNoteFolder)),
			dailyNoteFileFormat: getStringSetting(loaded, "dailyNoteFileFormat", DEFAULT_SETTINGS.dailyNoteFileFormat).trim() || DEFAULT_SETTINGS.dailyNoteFileFormat,
			dateFormat: getStringSetting(loaded, "dateFormat", DEFAULT_SETTINGS.dateFormat).trim() || DEFAULT_SETTINGS.dateFormat,
			timeFormat: getStringSetting(loaded, "timeFormat", DEFAULT_SETTINGS.timeFormat).trim() || DEFAULT_SETTINGS.timeFormat,
			captureToDailyNote: getBooleanSetting(loaded, "captureToDailyNote", DEFAULT_SETTINGS.captureToDailyNote),
			dailyHeading: normalizeHeadingText(getStringSetting(loaded, "dailyHeading", DEFAULT_SETTINGS.dailyHeading)),
			insertNewMemoAtTop: getBooleanSetting(loaded, "insertNewMemoAtTop", DEFAULT_SETTINGS.insertNewMemoAtTop),
			dailyGoal: normalizePositiveInteger(loaded?.dailyGoal, DEFAULT_SETTINGS.dailyGoal),
			randomReviewCount: normalizePositiveInteger(loaded?.randomReviewCount, DEFAULT_SETTINGS.randomReviewCount),
			heatmapDays: normalizePositiveInteger(loaded?.heatmapDays, DEFAULT_SETTINGS.heatmapDays),
			showAdvancedControls: getBooleanSetting(loaded, "showAdvancedControls", DEFAULT_SETTINGS.showAdvancedControls),
			attachmentFolder: normalizeFolder(getStringSetting(loaded, "attachmentFolder", DEFAULT_SETTINGS.attachmentFolder)),
			saveButtonLabel: normalizeButtonLabel(loaded?.saveButtonLabel, DEFAULT_SETTINGS.saveButtonLabel),
			draftContent: typeof loaded?.draftContent === "string" ? loaded.draftContent : "",
			draftTaskCapture: loaded?.draftTaskCapture === true,
			draftSaveTarget: normalizeSaveTarget(getOptionalStringSetting(loaded, "draftSaveTarget")),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	get language(): KotonohaLanguage {
		return getDisplayLanguage(this.settings.language);
	}

	t(key: TranslationKey, params: Record<string, string | number> = {}): string {
		return translate(key, this.language, params);
	}

	async captureMemo(rawContent: string) {
		await this.captureMemoToTarget(rawContent, "default");
	}

	async cleanVisibleMetadata() {
		let changed = 0;
		try {
			for (const file of await this.getSourceFiles()) {
				await this.app.vault.process(file, (raw) => {
					const cleaned = removeRedundantMetadata(raw, this.settings.captureToDailyNote ? this.settings.dailyHeading : null);
					if (cleaned === raw) return raw;
					changed += 1;
					return cleaned;
				});
			}
			if (changed > 0) {
				new Notice(this.t("cleanedMetadata"));
				this.refreshOpenViews();
			} else {
				new Notice(this.t("noMetadataToClean"));
			}
		} catch (error) {
			new Notice(error instanceof Error ? error.message : this.t("cleanMetadataFailed"));
		}
	}

	async saveAttachments(files: File[]): Promise<AttachmentSaveResult> {
		if (files.length === 0) return { links: [], paths: [] };
		if (files.length > MAX_ATTACHMENT_FILES) {
			throw new Error(this.t("attachmentTooMany", { count: MAX_ATTACHMENT_FILES }));
		}

		const folder = normalizeFolder(this.settings.attachmentFolder);
		await ensureFolder(this.app, folder);
		const links: string[] = [];
		const paths: string[] = [];

		try {
			for (const file of files) {
				if (file.size > MAX_ATTACHMENT_BYTES) {
					throw new Error(this.t("attachmentTooLarge", { mb: Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024) }));
				}
				const path = this.getAvailableAttachmentPath(folder, sanitizeAttachmentName(file.name));
				await this.app.vault.createBinary(path, await file.arrayBuffer());
				paths.push(path);
				links.push(`![[${path}]]`);
			}
		} catch (error) {
			await this.deleteAttachments(paths);
			throw error;
		}

		return { links, paths };
	}

	async deleteAttachments(paths: string[]) {
		for (const path of paths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.app.fileManager.trashFile(file);
			}
		}
	}

	getAvailableAttachmentPath(folder: string, fileName: string): string {
		const dotIndex = fileName.lastIndexOf(".");
		const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
		const extension = dotIndex > 0 ? fileName.slice(dotIndex) : "";
		let path = `${folder}/${fileName}`;
		let index = 2;

		while (this.app.vault.getAbstractFileByPath(path)) {
			path = `${folder}/${base}-${index}${extension}`;
			index += 1;
		}

		return path;
	}

	async captureMemoToTarget(rawContent: string, target: SaveTarget, forcedTaskStatus?: TaskStatus): Promise<CaptureResult | null> {
		const content = rawContent.trim();
		if (!content) {
			new Notice(this.t("emptyMemo"));
			return null;
		}
		if (content.length > MAX_MEMO_CONTENT_LENGTH) {
			new Notice(this.t("memoTooLong", { count: MAX_MEMO_CONTENT_LENGTH }));
			return null;
		}

		let result: CaptureResult;
		try {
			if (target === "daily" || (target === "default" && this.settings.captureToDailyNote)) {
				result = await this.appendToDailyNote(content, forcedTaskStatus);
			} else {
				result = await this.appendToMonthlyMemoFile(content, forcedTaskStatus);
			}
		} catch (error) {
			new Notice(error instanceof Error ? this.t("saveFailed", { message: error.message }) : this.t("saveFailedGeneric"));
			return null;
		}

		new Notice(result.target === "daily" ? this.t("savedDaily") : this.t("savedMonthly"));
		this.refreshOpenViews();
		return result;
	}

	async handleProtocolCapture(params: Record<string, string>) {
		const content = (params.text || params.content || params.body || "").toString().trim();
		if (!content) {
			new Notice(this.t("protocolEmpty"));
			return;
		}
		if (content.length > MAX_PROTOCOL_CONTENT_LENGTH) {
			new Notice(this.t("protocolTooLong", { count: MAX_PROTOCOL_CONTENT_LENGTH }));
			return;
		}

		const target = normalizeSaveTarget(params.target?.toString());
		const taskStatus = normalizeTaskStatus(params.task?.toString());
		await this.captureMemoToTarget(content, target, taskStatus);

		if (params.open === "true" || params.open === "1") {
			await this.activateView();
		}
	}

	async appendToMonthlyMemoFile(content: string, forcedTaskStatus?: TaskStatus): Promise<CaptureResult> {
		const folder = normalizeFolder(this.settings.memoFolder);
		await ensureFolder(this.app, folder);
		const path = `${folder}/${moment().format("YYYY-MM")}.md`;
		const file = await getOrCreateFile(this.app, path, `# ${moment().format("YYYY-MM")}\n\n`);
		const line = this.formatMemoLine(content, true, forcedTaskStatus);
		await this.app.vault.append(file, `${line}\n`);
		return { path, target: "monthly" };
	}

	async appendToDailyNote(content: string, forcedTaskStatus?: TaskStatus): Promise<CaptureResult> {
		const dailyNote = await this.resolveDailyNote();
		const file = await getOrCreateFile(this.app, dailyNote.path, dailyNote.initialContent);
		const raw = await this.app.vault.read(file);
		const updated = upsertUnderHeading(raw, this.settings.dailyHeading, this.formatMemoLine(content, false, forcedTaskStatus), this.settings.insertNewMemoAtTop);
		await this.app.vault.modify(file, updated);
		return { path: dailyNote.path, target: "daily" };
	}

	async resolveDailyNote(): Promise<{ path: string; initialContent: string }> {
		const dailyNotes = await loadCoreDailyNotesSettings(this.app);
		this.dailyNotesSettings = dailyNotes;
		const format = (dailyNotes?.format || this.settings.dailyNoteFileFormat || DEFAULT_SETTINGS.dailyNoteFileFormat).trim();
		const folder = normalizeOptionalFolder(dailyNotes?.folder ?? this.settings.dailyNoteFolder);
		const fileName = moment().format(format || DEFAULT_SETTINGS.dailyNoteFileFormat);
		const path = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;
		await ensureParentFolder(this.app, path);

		const title = fileName.split("/").pop() || fileName;
		const templateContent = await this.readDailyNoteTemplate(dailyNotes?.template);
		const initialContent = templateContent !== null
			? applyTemplateVariables(templateContent, title)
			: `# ${title}\n\n`;

		return { path, initialContent: ensureTrailingNewline(initialContent) };
	}

	async readDailyNoteTemplate(templatePath: string | undefined): Promise<string | null> {
		if (!templatePath) return null;
		const normalizedPath = templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`;
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (!(file instanceof TFile)) return null;
		return this.app.vault.read(file);
	}

	formatMemoLine(content: string, includeDate: boolean, forcedTaskStatus?: TaskStatus): string {
		const date = includeDate ? `${moment().format(this.settings.dateFormat || DEFAULT_SETTINGS.dateFormat)} ` : "";
		const time = moment().format(this.settings.timeFormat || DEFAULT_SETTINGS.timeFormat);
		const parsed = extractTaskInput(content);
		const escaped = parsed.content.replace(/\n/g, "\n  ");
		const taskStatus = forcedTaskStatus ?? parsed.taskStatus;
		return serializeMemoBlock(null, `${date}${time}`.trim(), escaped, "active", false, taskStatus);
	}

	async loadMemos(): Promise<MemoItem[]> {
		const files = await this.getSourceFiles();
		const all = await Promise.all(files.map((file) => this.loadMemosFromFile(file)));
		return all.flat().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdTime - a.createdTime || b.id.localeCompare(a.id));
	}

	async getSourceFiles(): Promise<TFile[]> {
		const fallbackFolder = normalizeFolder(this.settings.memoFolder);
		if (!this.settings.captureToDailyNote) {
			return listMarkdownFilesInFolder(this.app, fallbackFolder);
		}

		const dailyFolder = normalizeOptionalFolder(this.dailyNotesSettings?.folder ?? this.settings.dailyNoteFolder);
		const dailyFormat = this.dailyNotesSettings?.format ?? this.settings.dailyNoteFileFormat;
		if (dailyFolder) return listMarkdownFilesInFolder(this.app, dailyFolder);
		const inferredFolder = inferFolderFromDateFormat(dailyFormat);
		const files = await listMarkdownFilesInFolder(this.app, inferredFolder);
		return files.filter((file) => isLikelyDailyNotePath(file.path, dailyFormat));
	}

	async loadMemosFromFile(file: TFile): Promise<MemoItem[]> {
		const raw = await this.app.vault.read(file);
		return parseMemoItems(
			raw,
			file.path,
			this.settings.captureToDailyNote ? this.settings.dailyHeading : null
		);
	}

	async updateMemoContent(memo: MemoItem, content: string) {
		if (await this.replaceMemoBlock(memo, content.trim(), memo.status, memo.pinned, memo.taskStatus, this.t("memoUpdated"))) {
			this.refreshOpenViews();
		}
	}

	async updateMemoStatus(memo: MemoItem, status: MemoStatus) {
		const label = status === "archived" ? this.t("archivedNotice") : status === "deleted" ? this.t("trashedNotice") : this.t("restoredNotice");
		if (await this.replaceMemoBlock(memo, memo.content, status, memo.pinned, memo.taskStatus, label)) {
			this.refreshOpenViews();
		}
	}

	async updateMemoPinned(memo: MemoItem, pinned: boolean) {
		if (await this.replaceMemoBlock(memo, memo.content, memo.status, pinned, memo.taskStatus, pinned ? this.t("pinnedNotice") : this.t("unpinnedNotice"))) {
			this.refreshOpenViews();
		}
	}

	async updateMemoTaskStatus(memo: MemoItem, taskStatus: TaskStatus) {
		const label = taskStatus === "done" ? this.t("taskDoneNotice") : taskStatus === "open" ? this.t("taskOpenNotice") : this.t("taskNoneNotice");
		if (await this.replaceMemoBlock(memo, memo.content, memo.status, memo.pinned, taskStatus, label)) {
			this.refreshOpenViews();
		}
	}

	async deleteMemoPermanently(memo: MemoItem) {
		const file = this.app.vault.getAbstractFileByPath(memo.filePath);
		if (!(file instanceof TFile)) return;
		let deletedBlock: string[] = [];
		let deletedStartLine = 0;
		try {
			await this.app.vault.process(file, (raw) => {
				const target = findCurrentMemo(raw, memo, this.settings.captureToDailyNote ? this.settings.dailyHeading : null);
				if (!target) throw new Error(this.t("safeTargetError"));
				const lines = raw.split(/\r?\n/);
				deletedStartLine = target.startLine;
				deletedBlock = lines.slice(target.startLine, target.endLine + 1);
				lines.splice(target.startLine, target.endLine - target.startLine + 1);
				return lines.join("\n");
			});
			this.showUndoNotice(this.t("deletedPermanentlyNotice"), async () => {
				await this.app.vault.process(file, (raw) => {
					const blockText = deletedBlock.join("\n");
					if (raw.includes(blockText)) return raw;
					const lines = raw.split(/\r?\n/);
					lines.splice(Math.min(deletedStartLine, lines.length), 0, ...deletedBlock);
					return lines.join("\n");
				});
			});
			this.refreshOpenViews();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : this.t("deleteFailed"));
		}
	}

	async replaceMemoBlock(memo: MemoItem, content: string, status: MemoStatus, pinned: boolean, taskStatus: TaskStatus, successMessage: string): Promise<boolean> {
		if (!content) {
			new Notice(this.t("emptyMemo"));
			return false;
		}
		const file = this.app.vault.getAbstractFileByPath(memo.filePath);
		if (!(file instanceof TFile)) return false;
		let previousBlock: string[] = [];
		let updatedStorageId: string | null = null;
		let updatedFallback: { createdAt: string; content: string; taskStatus: TaskStatus; status: MemoStatus; pinned: boolean } | null = null;
		try {
			await this.app.vault.process(file, (raw) => {
				const target = findCurrentMemo(raw, memo, this.settings.captureToDailyNote ? this.settings.dailyHeading : null);
				if (!target) throw new Error(this.t("safeTargetError"));
				const lines = raw.split(/\r?\n/);
				const needsMetadata = status !== "active" || pinned;
				const storageId = needsMetadata ? target.storageId ?? memo.storageId ?? generateMemoId() : null;
				updatedStorageId = storageId;
				const nextCreatedAt = /^\d{4}-\d{2}-\d{2}\s+/.test(target.timestampText)
					? target.timestampText
					: `${inferDateFromPath(memo.filePath)} ${target.timestampText}`;
				updatedFallback = { createdAt: nextCreatedAt, content, taskStatus, status, pinned };
				previousBlock = lines.slice(target.startLine, target.endLine + 1);
				const nextBlock = serializeMemoBlock(storageId, target.timestampText, content, status, pinned, taskStatus).split("\n");
				lines.splice(target.startLine, target.endLine - target.startLine + 1, ...nextBlock);
				return lines.join("\n");
			});
			this.showUndoNotice(successMessage, async () => {
				await this.app.vault.process(file, (raw) => {
					const candidates = parseMemoItems(
						raw,
						memo.filePath,
						this.settings.captureToDailyNote ? this.settings.dailyHeading : null
					);
					const current = updatedStorageId
						? candidates.find((candidate) => candidate.storageId === updatedStorageId)
						: candidates.find((candidate) =>
							updatedFallback !== null &&
							candidate.createdAt === updatedFallback.createdAt &&
							candidate.content === updatedFallback.content &&
							candidate.taskStatus === updatedFallback.taskStatus &&
							candidate.status === updatedFallback.status &&
							candidate.pinned === updatedFallback.pinned
						);
					if (!current) throw new Error(this.t("undoTargetMissing"));
					const lines = raw.split(/\r?\n/);
					lines.splice(current.startLine, current.endLine - current.startLine + 1, ...previousBlock);
					return lines.join("\n");
				});
			});
			return true;
		} catch (error) {
			new Notice(error instanceof Error ? error.message : this.t("updateFailed"));
			return false;
		}
	}

	showUndoNotice(message: string, undo: () => Promise<void>) {
		const notice = new Notice(message, 7000);
		const undoButton = notice.messageEl.createEl("button", { text: this.t("undo") });
		undoButton.addEventListener("click", () => {
			void (async () => {
				try {
					await undo();
					notice.hide();
					this.refreshOpenViews();
					new Notice(this.t("undone"));
				} catch (error) {
					new Notice(error instanceof Error ? error.message : this.t("undoFailed"));
				}
			})();
		});
	}

	refreshOpenViews() {
		this.getOpenViews().forEach((view) => void view.reload());
	}

	getOpenViews(): KotonohaView[] {
		return this.app.workspace
			.getLeavesOfType(VIEW_TYPE_LOCAL_THINO)
			.map((leaf) => leaf.view)
			.filter((view): view is KotonohaView => view instanceof KotonohaView);
	}
}

class KotonohaView extends ItemView {
	plugin: KotonohaPlugin;
	memos: MemoItem[] = [];
	query = "";
	activeTag = "";
	statusFilter: StatusFilter = "active";
	dateFilter: DateFilter = "all";
	taskFilter: TaskFilter = "all";
	selectedDate = "";
	randomMemoIds = new Set<string>();
	saveTarget: SaveTarget = "default";
	viewLayout: ViewLayout = "list";
	taskCapture = false;
	attachmentFiles: File[] = [];
	inputEl: HTMLTextAreaElement | null = null;
	searchEl: HTMLInputElement | null = null;
	draftSaveTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: KotonohaPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_LOCAL_THINO;
	}

	getDisplayText() {
		return "Kotonoha";
	}

	getIcon() {
		return "message-square-plus";
	}

	async onOpen() {
		this.containerEl.empty();
		this.containerEl.addClass("kotonoha-view");
		await this.render();
		await this.reload();
	}

	async onClose() {
		if (this.draftSaveTimer !== null) window.clearTimeout(this.draftSaveTimer);
		await this.persistDraft();
	}

	async reload() {
		this.memos = await this.plugin.loadMemos();
		await this.renderList();
	}

	async render() {
		const root = this.containerEl;
		root.empty();
		root.addClass("kotonoha-view");

		const header = root.createDiv({ cls: "kotonoha-header" });
		const title = header.createDiv();
		title.createDiv({ cls: "kotonoha-title", text: "Kotonoha" });
		title.createEl("p", { text: this.plugin.t("titleSubtitle") });

		this.searchEl = null;

		if (this.plugin.settings.showAdvancedControls) {
			const search = root.createEl("input", {
				cls: "kotonoha-search",
				attr: { type: "search", placeholder: this.plugin.t("search") },
			});
			this.searchEl = search;
			search.addEventListener("input", () => {
				this.query = search.value.trim().toLowerCase();
				this.clearRandomReview();
				void this.renderList();
			});

			const controls = root.createDiv({ cls: "kotonoha-control-stack" });

			this.renderSegmented(this.createControlRow(controls, this.plugin.t("status")), [
				["active", this.plugin.t("normal")],
				["all", this.plugin.t("all")],
				["archived", this.plugin.t("archive")],
				["deleted", this.plugin.t("trash")],
			] as [StatusFilter, string][], (value) => {
				this.statusFilter = value;
				this.clearRandomReview();
				void this.renderList();
			}, "status");

			this.renderSegmented(this.createControlRow(controls, this.plugin.t("period")), [
				["all", this.plugin.t("allPeriod")],
				["today", this.plugin.t("today")],
				["week", this.plugin.t("sevenDays")],
				["month", this.plugin.t("thirtyDays")],
			] as [DateFilter, string][], (value) => {
				this.dateFilter = value;
				if (value !== "custom") this.selectedDate = "";
				this.clearRandomReview();
				void this.renderList();
			}, "date");

			this.renderSegmented(this.createControlRow(controls, this.plugin.t("type")), [
				["all", this.plugin.t("memoAndTask")],
				["memo", this.plugin.t("memoOnly")],
				["open", this.plugin.t("openTask")],
				["done", this.plugin.t("doneTask")],
			] as [TaskFilter, string][], (value) => {
				this.taskFilter = value;
				this.clearRandomReview();
				void this.renderList();
			}, "task");

			this.renderSegmented(this.createControlRow(controls, this.plugin.t("display")), [
				["list", this.plugin.t("detailList")],
				["compact", this.plugin.t("compact")],
				["grid", this.plugin.t("cardGrid")],
			] as [ViewLayout, string][], (value) => {
				this.viewLayout = value;
				void this.renderList();
			}, "layout");

			root.createDiv({ cls: "kotonoha-stats" });
			root.createDiv({ cls: "kotonoha-progress" });
			root.createDiv({ cls: "kotonoha-heatmap" });
			root.createDiv({ cls: "kotonoha-context" });
			root.createDiv({ cls: "kotonoha-tags" });
		}
		root.createDiv({ cls: "kotonoha-list" });
		this.renderCapture(root);
		this.registerViewShortcuts(root);
	}

	renderCapture(root: HTMLElement) {
		const capture = root.createDiv({ cls: "kotonoha-capture" });
		const input = capture.createEl("textarea", {
			cls: "kotonoha-input",
			attr: { placeholder: this.plugin.t("placeholder") },
		});
		this.inputEl = input;
		input.value = this.plugin.settings.draftContent;
		this.taskCapture = this.plugin.settings.draftTaskCapture;
		this.saveTarget = this.plugin.settings.draftSaveTarget;

		const actions = capture.createDiv({ cls: "kotonoha-actions" });
		const taskButton = actions.createEl("button", { text: this.plugin.t("task") });
		const attachButton = actions.createEl("button", { text: this.plugin.t("attach") });
		const saveButton = actions.createEl("button", { text: this.getSaveButtonText(), cls: "kotonoha-primary-button" });
		const fileInput = capture.createEl("input", {
			cls: "kotonoha-file-input",
			attr: { type: "file", multiple: "true" },
		});

		const targetLine = capture.createDiv({ cls: "kotonoha-target-line" });

		const updateCaptureButtons = () => {
			taskButton.toggleClass("is-active", this.taskCapture);
			attachButton.setText(this.attachmentFiles.length > 0 ? this.plugin.t("attachCount", { count: this.attachmentFiles.length }) : this.plugin.t("attach"));
			const hasContent = input.value.trim().length > 0 || this.attachmentFiles.length > 0;
			saveButton.disabled = !hasContent;
			saveButton.toggleClass("is-disabled", !hasContent);
			targetLine.setText(this.plugin.t("targetLine", { target: this.getTargetLabel(), heading: this.plugin.settings.dailyHeading }));
		};

		const saveCapture = async () => {
			try {
				const attachments = await this.plugin.saveAttachments(this.attachmentFiles);
				const content = [input.value.trim(), ...attachments.links].filter(Boolean).join("\n");
				const saved = await this.plugin.captureMemoToTarget(content, this.saveTarget, this.taskCapture ? "open" : undefined);
				if (!saved) {
					await this.plugin.deleteAttachments(attachments.paths);
					return;
				}
				input.value = "";
				this.attachmentFiles = [];
				fileInput.value = "";
				this.taskCapture = false;
				await this.clearDraft();
				updateCaptureButtons();
			} catch (error) {
				new Notice(error instanceof Error ? this.plugin.t("attachmentSaveFailed", { message: error.message }) : this.plugin.t("attachmentSaveFailedGeneric"));
			}
		};

		saveButton.addEventListener("click", () => void saveCapture());
		taskButton.addEventListener("click", () => {
			this.taskCapture = !this.taskCapture;
			updateCaptureButtons();
			this.scheduleDraftSave();
			input.focus();
		});
		attachButton.addEventListener("click", () => fileInput.click());
		fileInput.addEventListener("change", () => {
			this.attachmentFiles = Array.from(fileInput.files ?? []);
			updateCaptureButtons();
			this.scheduleDraftSave();
		});
		input.addEventListener("input", () => {
			updateCaptureButtons();
			this.scheduleDraftSave();
		});
		input.addEventListener("keydown", (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
				event.preventDefault();
				void saveCapture();
			}
		});
		updateCaptureButtons();

		if (this.plugin.settings.showAdvancedControls) {
			this.renderSegmented(this.createControlRow(capture, this.plugin.t("saveTarget")), [
				["default", this.plugin.t("defaultTarget")],
				["daily", this.plugin.t("dailyTarget")],
				["monthly", this.plugin.t("monthlyTarget")],
			] as [SaveTarget, string][], (value) => {
				this.saveTarget = value;
				this.updateFilterButtonStates();
				this.scheduleDraftSave();
			}, "save");

			const secondaryActions = capture.createDiv({ cls: "kotonoha-secondary-actions" });
			secondaryActions.createEl("button", { text: this.plugin.t("reflectRandom") }).addEventListener("click", () => this.pickReviewMemo("random"));
			secondaryActions.createEl("button", { text: this.plugin.t("reflectToday") }).addEventListener("click", () => this.pickReviewMemo("today"));
			secondaryActions.createEl("button", { text: this.plugin.t("reflectSevenDaysAgo") }).addEventListener("click", () => this.pickReviewMemo("sevenDaysAgo"));
			secondaryActions.createEl("button", { text: this.plugin.t("reload") }).addEventListener("click", () => void this.reload());
		}
		capture.createDiv({ cls: "kotonoha-hint", text: this.plugin.t("hint") });
	}

	getSaveButtonText(): string {
		const label = this.plugin.settings.saveButtonLabel.trim();
		return label && label !== DEFAULT_SETTINGS.saveButtonLabel ? label : this.plugin.t("save");
	}

	getTargetLabel(): string {
		if (this.saveTarget === "monthly" || (this.saveTarget === "default" && !this.plugin.settings.captureToDailyNote)) {
			return this.plugin.t("targetMonthly");
		}
		return this.plugin.t("targetDaily");
	}

	scheduleDraftSave() {
		if (this.draftSaveTimer !== null) window.clearTimeout(this.draftSaveTimer);
		this.draftSaveTimer = window.setTimeout(() => {
			this.draftSaveTimer = null;
			void this.persistDraft();
		}, 300);
	}

	async persistDraft() {
		this.plugin.settings.draftContent = this.inputEl?.value ?? this.plugin.settings.draftContent;
		this.plugin.settings.draftTaskCapture = this.taskCapture;
		this.plugin.settings.draftSaveTarget = this.saveTarget;
		await this.plugin.saveSettings();
	}

	async clearDraft() {
		if (this.draftSaveTimer !== null) {
			window.clearTimeout(this.draftSaveTimer);
			this.draftSaveTimer = null;
		}
		this.plugin.settings.draftContent = "";
		this.plugin.settings.draftTaskCapture = false;
		this.plugin.settings.draftSaveTarget = "default";
		await this.plugin.saveSettings();
	}

	createControlRow(container: HTMLElement, label: string): HTMLElement {
		const row = container.createDiv({ cls: "kotonoha-control-row" });
		row.createDiv({ cls: "kotonoha-control-label", text: label });
		return row.createDiv({ cls: "kotonoha-filters" });
	}

	renderSegmented<T extends string>(container: HTMLElement, options: [T, string][], onPick: (value: T) => void, group = "filter") {
		for (const [value, label] of options) {
			const button = container.createEl("button", { text: label, cls: "kotonoha-filter-button" });
			button.dataset.value = value;
			button.dataset.group = group;
			button.addEventListener("click", () => onPick(value));
		}
	}

	registerViewShortcuts(root: HTMLElement) {
		root.tabIndex = 0;
		this.registerDomEvent(root, "keydown", (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const editingText = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
			if (event.key === "/" && !editingText) {
				event.preventDefault();
				this.searchEl?.focus();
			}
			if (event.key === "i" && !editingText) {
				event.preventDefault();
				this.inputEl?.focus();
			}
			if (event.key === "Escape") {
				this.inputEl?.blur();
				this.searchEl?.blur();
			}
		});
	}

	pickRandomMemo() {
		this.pickReviewMemo("random");
	}

	pickReviewMemo(mode: ReviewMode) {
		if (mode === "today") {
			this.dateFilter = "today";
			this.selectedDate = "";
			this.randomMemoIds.clear();
			void this.renderList();
			return;
		}
		if (mode === "sevenDaysAgo") {
			this.dateFilter = "custom";
			this.selectedDate = moment().subtract(7, "days").format("YYYY-MM-DD");
			this.randomMemoIds.clear();
			void this.renderList();
			return;
		}

		const candidates = this.getFilteredMemos(false);
		if (candidates.length === 0) {
			new Notice(this.plugin.t("noReviewMemos"));
			return;
		}
		const shuffled = [...candidates].sort(() => Math.random() - 0.5);
		const count = Math.max(1, Math.min(this.plugin.settings.randomReviewCount, shuffled.length));
		this.randomMemoIds = new Set(shuffled.slice(0, count).map((memo) => memo.id));
		void this.renderList();
	}

	async renderList() {
		const stats = this.containerEl.querySelector<HTMLElement>(".kotonoha-stats");
		const progress = this.containerEl.querySelector<HTMLElement>(".kotonoha-progress");
		const heatmap = this.containerEl.querySelector<HTMLElement>(".kotonoha-heatmap");
		const context = this.containerEl.querySelector<HTMLElement>(".kotonoha-context");
		const tagBar = this.containerEl.querySelector<HTMLElement>(".kotonoha-tags");
		const list = this.containerEl.querySelector<HTMLElement>(".kotonoha-list");
		if (!list) return;

		this.updateFilterButtonStates();
		if (stats) this.renderStats(stats);
		if (progress) this.renderDailyProgress(progress);
		if (heatmap) this.renderHeatmap(heatmap);
		if (context) this.renderContext(context);
		if (tagBar) this.renderTags(tagBar);
		list.empty();
		list.className = `kotonoha-list kotonoha-layout-${this.viewLayout}`;

		const filtered = this.getFilteredMemos(true);

		if (filtered.length === 0) {
			const empty = list.createDiv({ cls: "kotonoha-empty" });
			empty.createDiv({ cls: "kotonoha-empty-title", text: this.memos.length === 0 ? this.plugin.t("emptyNoMemos") : this.plugin.t("emptyFiltered") });
			const focusButton = empty.createEl("button", { text: this.plugin.t("save") });
			focusButton.addEventListener("click", () => this.inputEl?.focus());
			return;
		}

		let currentDate = "";
		for (const memo of filtered) {
			const memoDate = memo.createdAt.slice(0, 10);
			if (memoDate !== currentDate) {
				currentDate = memoDate;
				list.createDiv({
					cls: "kotonoha-date-heading",
					text: formatDateGroupLabel(memoDate, this.plugin.language),
				});
			}
			await this.renderMemoCard(list, memo);
		}
	}

	updateFilterButtonStates() {
		this.containerEl.querySelectorAll(".kotonoha-filter-button").forEach((button) => {
			const el = button as HTMLElement;
			const group = el.dataset.group;
			const active =
				(group === "save" && el.dataset.value === this.saveTarget) ||
				(group === "task" && el.dataset.value === this.taskFilter) ||
				(group === "layout" && el.dataset.value === this.viewLayout) ||
				(group === "status" && el.dataset.value === this.statusFilter) ||
				(group === "date" && el.dataset.value === this.dateFilter);
			el.toggleClass("is-active", active);
		});
	}

	renderStats(stats: HTMLElement) {
		stats.empty();
		const active = this.memos.filter((memo) => memo.status === "active");
		const todayStart = moment().startOf("day").valueOf();
		const todayCount = active.filter((memo) => memo.createdTime >= todayStart).length;
		const archivedCount = this.memos.filter((memo) => memo.status === "archived").length;
		const deletedCount = this.memos.filter((memo) => memo.status === "deleted").length;
		const openTaskCount = active.filter((memo) => memo.taskStatus === "open").length;
		stats.createSpan({ text: this.plugin.t("activeCount", { count: active.length }) });
		stats.createSpan({ text: this.plugin.t("todayCount", { count: todayCount }) });
		stats.createSpan({ text: this.plugin.t("archiveCount", { count: archivedCount }) });
		stats.createSpan({ text: this.plugin.t("openTaskCount", { count: openTaskCount }) });
		stats.createSpan({ text: this.plugin.t("trashCount", { count: deletedCount }) });
	}

	renderContext(context: HTMLElement) {
		context.empty();
		const chips: { label: string; onClear?: () => void }[] = [];
		if (this.dateFilter === "custom" && this.selectedDate) {
			chips.push({
				label: this.plugin.t("customDateChip", { date: this.selectedDate }),
				onClear: () => {
					this.dateFilter = "all";
					this.selectedDate = "";
					void this.renderList();
				},
			});
		}
		if (this.randomMemoIds.size > 0) {
			chips.push({
				label: this.plugin.t("randomReviewChip", { count: this.randomMemoIds.size }),
				onClear: () => {
					this.clearRandomReview();
					void this.renderList();
				},
			});
		}
		if (this.activeTag) {
			chips.push({
				label: this.plugin.t("tagChip", { tag: this.activeTag }),
				onClear: () => {
					this.activeTag = "";
					void this.renderList();
				},
			});
		}

		if (chips.length === 0) return;
		for (const chip of chips) {
			const button = context.createEl("button", { text: `${chip.label} ×`, cls: "kotonoha-context-chip" });
			button.addEventListener("click", () => chip.onClear?.());
		}
	}

	renderDailyProgress(progress: HTMLElement) {
		progress.empty();
		const goal = Math.max(1, this.plugin.settings.dailyGoal);
		const today = moment().format("YYYY-MM-DD");
		const count = this.memos.filter((memo) => memo.status === "active" && memo.createdAt.startsWith(today)).length;
		const percent = Math.min(100, Math.round((count / goal) * 100));
		const label = progress.createDiv({ cls: "kotonoha-progress-label" });
		label.createSpan({ text: this.plugin.t("dailyProgress", { count, goal }) });
		label.createSpan({ text: `${percent}%` });
		const track = progress.createDiv({ cls: "kotonoha-progress-track" });
		const bar = track.createDiv({ cls: "kotonoha-progress-bar" });
		bar.style.width = `${percent}%`;
	}

	renderHeatmap(heatmap: HTMLElement) {
		heatmap.empty();
		const counts = this.getDailyCounts();
		const max = Math.max(1, ...Array.from(counts.values()));
		const days = Math.max(7, Math.min(120, this.plugin.settings.heatmapDays));
		const start = moment().subtract(days - 1, "days").startOf("day");

		for (let index = 0; index < days; index += 1) {
			const day = start.clone().add(index, "days");
			const key = day.format("YYYY-MM-DD");
			const count = counts.get(key) ?? 0;
			const level = count === 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4));
			const cell = heatmap.createEl("button", {
				text: String(count || ""),
				cls: `kotonoha-heatmap-cell level-${level}${this.selectedDate === key ? " is-active" : ""}`,
				attr: { title: this.plugin.t("heatmapTitle", { date: key, count }) },
			});
			cell.addEventListener("click", () => {
				this.dateFilter = "custom";
				this.selectedDate = key;
				this.clearRandomReview();
				void this.renderList();
			});
		}
	}

	getDailyCounts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const memo of this.memos) {
			if (memo.status !== "active") continue;
			const date = memo.createdAt.slice(0, 10);
			counts.set(date, (counts.get(date) ?? 0) + 1);
		}
		return counts;
	}

	renderTags(tagBar: HTMLElement) {
		tagBar.empty();
		const visible = this.getFilteredMemos(false);
		const tags = Array.from(new Set(visible.flatMap((memo) => memo.tags))).sort();
		if (this.activeTag) {
			tagBar.createEl("button", { text: this.plugin.t("clear"), cls: "kotonoha-tag is-active" }).addEventListener("click", () => {
				this.activeTag = "";
				this.clearRandomReview();
				void this.renderList();
			});
		}
		for (const tag of tags.slice(0, 40)) {
			const tagEl = tagBar.createEl("button", {
				text: tag,
				cls: `kotonoha-tag${this.activeTag === tag ? " is-active" : ""}`,
			});
			tagEl.addEventListener("click", () => {
				this.activeTag = this.activeTag === tag ? "" : tag;
				this.clearRandomReview();
				void this.renderList();
			});
		}
	}

	async renderMemoCard(list: HTMLElement, memo: MemoItem) {
		const item = list.createDiv({ cls: `kotonoha-item kotonoha-status-${memo.status}` });
		if (this.randomMemoIds.has(memo.id)) item.addClass("is-random-pick");
		if (memo.pinned) item.addClass("is-pinned");

		const meta = item.createDiv({ cls: "kotonoha-meta" });
		const openNoteButton = meta.createEl("button", {
			text: `${memo.pinned ? this.plugin.t("pinnedPrefix") : ""}${formatMemoMetaTime(memo)}`,
			cls: "kotonoha-open-note-link",
			attr: { title: this.plugin.t("openNote") },
		});
		openNoteButton.addEventListener("click", () => {
			void this.openMemoNote(memo);
		});
		if (this.plugin.settings.showAdvancedControls) {
			const fileLink = meta.createEl("a", { text: memo.filePath });
			fileLink.addEventListener("click", (event) => {
				event.preventDefault();
				void (async () => {
					const file = this.plugin.app.vault.getAbstractFileByPath(memo.filePath);
					if (file instanceof TFile) {
						await this.plugin.app.workspace.getLeaf(false).openFile(file);
					}
				})();
			});
		}

		const contentRow = item.createDiv({ cls: `kotonoha-content-row kotonoha-task-${memo.taskStatus}` });
		if (memo.taskStatus !== "none") {
			const taskToggle = contentRow.createEl("button", {
				text: memo.taskStatus === "done" ? "✓" : "□",
				cls: "kotonoha-task-indicator",
				attr: { title: memo.taskStatus === "done" ? this.plugin.t("backToOpen") : this.plugin.t("completeTask") },
			});
			taskToggle.addEventListener("click", () => {
				void this.plugin.updateMemoTaskStatus(memo, memo.taskStatus === "done" ? "open" : "done");
			});
		}

		const content = contentRow.createDiv({ cls: "kotonoha-content" });
		await MarkdownRenderer.render(this.plugin.app, memo.content, content, memo.filePath, this);

		const editBox = item.createEl("textarea", { cls: "kotonoha-edit-box" });
		editBox.value = memo.content;
		editBox.hide();

		const actions = item.createDiv({ cls: "kotonoha-card-actions" });
		const moreButton = actions.createEl("button", { text: this.plugin.t("more") });
		const detailActions = item.createDiv({ cls: "kotonoha-card-detail-actions" });
		detailActions.hide();

		const editButton = detailActions.createEl("button", { text: this.plugin.t("edit") });
		detailActions.createEl("button", { text: memo.pinned ? this.plugin.t("unpin") : this.plugin.t("pin") }).addEventListener("click", () => {
			void this.plugin.updateMemoPinned(memo, !memo.pinned);
		});
		detailActions.createEl("button", { text: memo.taskStatus === "done" ? this.plugin.t("backToOpen") : this.plugin.t("completeTask") }).addEventListener("click", () => {
			void this.plugin.updateMemoTaskStatus(memo, memo.taskStatus === "done" ? "open" : "done");
		});
		detailActions.createEl("button", { text: memo.taskStatus === "none" ? this.plugin.t("taskify") : this.plugin.t("untask") }).addEventListener("click", () => {
			void this.plugin.updateMemoTaskStatus(memo, memo.taskStatus === "none" ? "open" : "none");
		});
		detailActions.createEl("button", { text: this.plugin.t("openNote") }).addEventListener("click", () => {
			void this.openMemoNote(memo);
		});
		const saveButton = actions.createEl("button", { text: this.plugin.t("save") });
		const cancelButton = actions.createEl("button", { text: this.plugin.t("cancel") });
		saveButton.hide();
		cancelButton.hide();

		moreButton.addEventListener("click", () => {
			detailActions.toggleClass("is-open", !detailActions.hasClass("is-open"));
			if (detailActions.hasClass("is-open")) {
				detailActions.show();
				moreButton.setText(this.plugin.t("close"));
			} else {
				detailActions.hide();
				moreButton.setText(this.plugin.t("more"));
			}
		});

		editButton.addEventListener("click", () => {
			content.hide();
			moreButton.hide();
			detailActions.hide();
			editBox.show();
			saveButton.show();
			cancelButton.show();
			editBox.focus();
		});
		cancelButton.addEventListener("click", () => {
			editBox.value = memo.content;
			editBox.hide();
			saveButton.hide();
			cancelButton.hide();
			content.show();
			moreButton.show();
		});
		saveButton.addEventListener("click", () => {
			void this.plugin.updateMemoContent(memo, editBox.value);
		});

		if (memo.status !== "archived") {
			detailActions.createEl("button", { text: this.plugin.t("archive") }).addEventListener("click", () => {
				void this.plugin.updateMemoStatus(memo, "archived");
			});
		}
		if (memo.status !== "active") {
			detailActions.createEl("button", { text: this.plugin.t("restore") }).addEventListener("click", () => {
				void this.plugin.updateMemoStatus(memo, "active");
			});
		}
		if (memo.status !== "deleted") {
			detailActions.createEl("button", { text: this.plugin.t("trash") }).addEventListener("click", () => {
				void this.plugin.updateMemoStatus(memo, "deleted");
			});
		} else {
			detailActions.createEl("button", { text: this.plugin.t("deletePermanently") }).addEventListener("click", () => {
				new ConfirmDeleteMemoModal(this.plugin, () => {
					void this.plugin.deleteMemoPermanently(memo);
				}).open();
			});
		}
	}

	async openMemoNote(memo: MemoItem) {
		const file = this.plugin.app.vault.getAbstractFileByPath(memo.filePath);
		if (file instanceof TFile) {
			await this.plugin.app.workspace.getLeaf(false).openFile(file);
		}
	}

	getFilteredMemos(applyRandom: boolean): MemoItem[] {
		const now = moment();
		const since = this.dateFilter === "today"
			? now.clone().startOf("day").valueOf()
			: this.dateFilter === "week"
				? now.clone().subtract(7, "days").startOf("day").valueOf()
				: this.dateFilter === "month"
					? now.clone().subtract(30, "days").startOf("day").valueOf()
					: 0;

		const filtered = this.memos.filter((memo) => {
			const matchesStatus = this.statusFilter === "all" ? memo.status !== "deleted" : memo.status === this.statusFilter;
			const matchesDate = since === 0 || memo.createdTime >= since;
			const matchesSelectedDate = this.dateFilter !== "custom" || memo.createdAt.startsWith(this.selectedDate);
			const matchesTask =
				this.taskFilter === "all" ||
				(this.taskFilter === "memo" && memo.taskStatus === "none") ||
				(this.taskFilter === "open" && memo.taskStatus === "open") ||
				(this.taskFilter === "done" && memo.taskStatus === "done");
			const matchesQuery = !this.query || memo.content.toLowerCase().includes(this.query);
			const matchesTag = !this.activeTag || memo.tags.includes(this.activeTag);
			return matchesStatus && matchesDate && matchesSelectedDate && matchesTask && matchesQuery && matchesTag;
		});

		if (!applyRandom || this.randomMemoIds.size === 0) return filtered;
		return filtered.filter((memo) => this.randomMemoIds.has(memo.id));
	}

	clearRandomReview() {
		this.randomMemoIds.clear();
	}
}

class KotonohaSettingTab extends PluginSettingTab {
	plugin: KotonohaPlugin;

	constructor(app: App, plugin: KotonohaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		this.renderSettings();
	}

	renderSettings() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("p", {
			cls: "kotonoha-settings-lead",
			text: this.plugin.t("settingsLead"),
		});

		const hero = containerEl.createDiv({ cls: "kotonoha-settings-hero" });
		const heroText = hero.createDiv();
		heroText.createDiv({ cls: "kotonoha-settings-title", text: "Kotonoha" });
		heroText.createEl("p", { text: this.plugin.t("settingsHero") });
		hero.createEl("button", { text: this.plugin.t("openMemo") }).addEventListener("click", () => {
			void this.plugin.activateView();
		});

		new Setting(containerEl)
			.setName(this.plugin.t("languageSetting"))
			.setDesc(this.plugin.t("languageSettingDesc"))
			.addDropdown((dropdown) => dropdown
				.addOption("auto", this.plugin.t("languageAuto"))
				.addOption("ja", this.plugin.t("languageJapanese"))
				.addOption("en", this.plugin.t("languageEnglish"))
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = normalizeLanguageSetting(value);
					await this.plugin.saveSettings();
					this.renderSettings();
					for (const view of this.plugin.getOpenViews()) {
						await view.render();
						await view.reload();
					}
				}));

		new Setting(containerEl).setName(this.plugin.t("featuresHeading")).setHeading();
		const features = containerEl.createDiv({ cls: "kotonoha-settings-grid" });
		createFeatureCard(features, this.plugin.t("basicFeature"), this.plugin.t("basicFeatureDesc"));
		createFeatureCard(features, this.plugin.t("saveFeature"), this.plugin.t("saveFeatureDesc"));
		createFeatureCard(features, this.plugin.t("displayFeature"), this.plugin.t("displayFeatureDesc"));
		createFeatureCard(features, this.plugin.t("editorFeature"), this.plugin.t("editorFeatureDesc"));
		createFeatureCard(features, this.plugin.t("reflectFeature"), this.plugin.t("reflectFeatureDesc"));
		createFeatureCard(features, this.plugin.t("attachmentFeature"), this.plugin.t("attachmentFeatureDesc"));

		new Setting(containerEl).setName(this.plugin.t("saveSettings")).setHeading();

		new Setting(containerEl)
			.setName(this.plugin.t("captureToDailyNote"))
			.setDesc(this.plugin.t("captureToDailyNoteDesc"))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.captureToDailyNote)
				.onChange(async (value) => {
					this.plugin.settings.captureToDailyNote = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("dailyNoteFolder"))
			.setDesc(this.plugin.t("dailyNoteFolderDesc"))
			.addText((text) => text
				.setPlaceholder("例: Daily, 01_diary")
				.setValue(this.plugin.settings.dailyNoteFolder)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteFolder = normalizeOptionalFolder(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("dailyNoteFileName"))
			.setDesc(this.plugin.t("dailyNoteFileNameDesc"))
			.addText((text) => text
				.setPlaceholder("YYYY-MM-DD")
				.setValue(this.plugin.settings.dailyNoteFileFormat)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteFileFormat = value.trim() || DEFAULT_SETTINGS.dailyNoteFileFormat;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("dailyHeading"))
			.setDesc(this.plugin.t("dailyHeadingDesc"))
			.addText((text) => text
				.setPlaceholder("つぶやき")
				.setValue(this.plugin.settings.dailyHeading)
				.onChange(async (value) => {
					this.plugin.settings.dailyHeading = normalizeHeadingText(value) || DEFAULT_SETTINGS.dailyHeading;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("insertNewMemoAtTop"))
			.setDesc(this.plugin.t("insertNewMemoAtTopDesc"))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.insertNewMemoAtTop)
				.onChange(async (value) => {
					this.plugin.settings.insertNewMemoAtTop = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("monthlyFolder"))
			.setDesc(this.plugin.t("monthlyFolderDesc"))
			.addText((text) => text
				.setPlaceholder("Kotonoha")
				.setValue(this.plugin.settings.memoFolder)
				.onChange(async (value) => {
					this.plugin.settings.memoFolder = value.trim() || DEFAULT_SETTINGS.memoFolder;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("attachmentFolder"))
			.setDesc(this.plugin.t("attachmentFolderDesc"))
			.addText((text) => text
				.setPlaceholder("Kotonoha/attachments")
				.setValue(this.plugin.settings.attachmentFolder)
				.onChange(async (value) => {
					this.plugin.settings.attachmentFolder = normalizeFolder(value || DEFAULT_SETTINGS.attachmentFolder);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("saveButtonLabel"))
			.setDesc(this.plugin.t("saveButtonLabelDesc"))
			.addText((text) => text
				.setPlaceholder("残す")
				.setValue(this.plugin.settings.saveButtonLabel)
				.onChange(async (value) => {
					this.plugin.settings.saveButtonLabel = normalizeButtonLabel(value, DEFAULT_SETTINGS.saveButtonLabel);
					await this.plugin.saveSettings();
					for (const view of this.plugin.getOpenViews()) {
						await view.render();
						await view.reload();
					}
				}));

		new Setting(containerEl).setName(this.plugin.t("displaySettings")).setHeading();

		new Setting(containerEl)
			.setName(this.plugin.t("showAdvancedControls"))
			.setDesc(this.plugin.t("showAdvancedControlsDesc"))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.showAdvancedControls)
				.onChange(async (value) => {
					this.plugin.settings.showAdvancedControls = value;
					await this.plugin.saveSettings();
					for (const view of this.plugin.getOpenViews()) {
						await view.render();
						await view.reload();
					}
				}));

		new Setting(containerEl).setName(this.plugin.t("reflectSettings")).setHeading();

		new Setting(containerEl)
			.setName(this.plugin.t("dailyGoal"))
			.setDesc(this.plugin.t("dailyGoalDesc"))
			.addText((text) => text
				.setPlaceholder("5")
				.setValue(String(this.plugin.settings.dailyGoal))
				.onChange(async (value) => {
					this.plugin.settings.dailyGoal = normalizePositiveInteger(Number(value), DEFAULT_SETTINGS.dailyGoal);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("randomReviewCount"))
			.setDesc(this.plugin.t("randomReviewCountDesc"))
			.addText((text) => text
				.setPlaceholder("10")
				.setValue(String(this.plugin.settings.randomReviewCount))
				.onChange(async (value) => {
					this.plugin.settings.randomReviewCount = normalizePositiveInteger(Number(value), DEFAULT_SETTINGS.randomReviewCount);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(this.plugin.t("heatmapDays"))
			.setDesc(this.plugin.t("heatmapDaysDesc"))
			.addText((text) => text
				.setPlaceholder("42")
				.setValue(String(this.plugin.settings.heatmapDays))
				.onChange(async (value) => {
					this.plugin.settings.heatmapDays = normalizePositiveInteger(Number(value), DEFAULT_SETTINGS.heatmapDays);
					await this.plugin.saveSettings();
				}));
	}
}

function createFeatureCard(container: HTMLElement, title: string, description: string) {
	const card = container.createDiv({ cls: "kotonoha-settings-card" });
	card.createDiv({ cls: "kotonoha-settings-card-icon", text: "•" });
	const body = card.createDiv();
	body.createEl("strong", { text: title });
	body.createEl("p", { text: description });
}

class ConfirmDeleteMemoModal extends Modal {
	private readonly plugin: KotonohaPlugin;
	private readonly onConfirm: () => void;

	constructor(plugin: KotonohaPlugin, onConfirm: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createDiv({ cls: "kotonoha-modal-title", text: this.plugin.t("deleteModalTitle") });
		contentEl.createEl("p", { text: this.plugin.t("deleteModalDesc") });

		const actions = contentEl.createDiv({ cls: "kotonoha-modal-actions" });
		actions.createEl("button", { text: this.plugin.t("cancel") }).addEventListener("click", () => this.close());
		actions.createEl("button", { text: this.plugin.t("deleteAction"), cls: "mod-warning" }).addEventListener("click", () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

async function ensureFolder(app: App, folder: string) {
	if (app.vault.getAbstractFileByPath(folder)) return;
	const parts = folder.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

async function ensureParentFolder(app: App, path: string) {
	const parent = path.split("/").slice(0, -1).join("/");
	if (parent) await ensureFolder(app, parent);
}

async function listMarkdownFilesInFolder(app: App, folder: string): Promise<TFile[]> {
	const normalizedFolder = normalizeOptionalFolder(folder);
	const root = normalizedFolder;
	const results: TFile[] = [];

	async function visit(currentFolder: string) {
		let listed: { files: string[]; folders: string[] };
		try {
			listed = await app.vault.adapter.list(currentFolder);
		} catch {
			return;
		}

		for (const filePath of listed.files) {
			if (!filePath.toLowerCase().endsWith(".md")) continue;
			const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
			if (file instanceof TFile) results.push(file);
		}

		for (const childFolder of listed.folders) {
			await visit(normalizePath(childFolder));
		}
	}

	await visit(root);
	return results;
}

async function getOrCreateFile(app: App, path: string, initialContent: string): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	return app.vault.create(path, initialContent);
}

function normalizeFolder(folder: string): string {
	const normalized = sanitizeVaultRelativePath(folder || DEFAULT_SETTINGS.memoFolder);
	return normalizePath(normalized || DEFAULT_SETTINGS.memoFolder);
}

function asLoadedSettings(value: unknown): LoadedSettings {
	return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringSetting(settings: LoadedSettings, key: keyof KotonohaSettings, fallback: string): string {
	const value = settings[key];
	return typeof value === "string" ? value : fallback;
}

function getOptionalStringSetting(settings: LoadedSettings, key: keyof KotonohaSettings): string | undefined {
	const value = settings[key];
	return typeof value === "string" ? value : undefined;
}

function getBooleanSetting(settings: LoadedSettings, key: keyof KotonohaSettings, fallback: boolean): boolean {
	const value = settings[key];
	return typeof value === "boolean" ? value : fallback;
}

function normalizeOptionalFolder(folder: string): string {
	const normalized = sanitizeVaultRelativePath(folder || "");
	return normalized ? normalizePath(normalized) : "";
}

function sanitizeVaultRelativePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.split("")
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code > 31 && code !== 127;
		})
		.join("")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part && part !== "." && part !== "..")
		.join("/");
}

function normalizeHeadingText(heading: string): string {
	return heading.trim().replace(/^#{1,6}\s*/, "").replace(/\s+#{1,6}$/, "").trim();
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return Math.round(parsed);
}

async function loadCoreDailyNotesSettings(app: App): Promise<DailyNotesSettings | null> {
	const configPath = normalizePath(`${app.vault.configDir}/daily-notes.json`);
	if (!(await app.vault.adapter.exists(configPath))) return null;
	try {
		const options = JSON.parse(await app.vault.adapter.read(configPath)) as Record<string, unknown>;
		return {
			folder: typeof options.folder === "string" ? options.folder : undefined,
			format: typeof options.format === "string" ? options.format : undefined,
			template: typeof options.template === "string" ? options.template : undefined,
		};
	} catch {
		return null;
	}
}

function applyTemplateVariables(template: string, title: string): string {
	const now = moment();
	return template
		.replace(/{{\s*title\s*}}/gi, title)
		.replace(/{{\s*date\s*}}/gi, now.format("YYYY-MM-DD"))
		.replace(/{{\s*time\s*}}/gi, now.format("HH:mm"))
		.replace(/{{\s*date:([^}]+)\s*}}/gi, (_match, format: string) => now.format(format.trim()))
		.replace(/{{\s*time:([^}]+)\s*}}/gi, (_match, format: string) => now.format(format.trim()));
}

function ensureTrailingNewline(content: string): string {
	return content.endsWith("\n") ? content : `${content}\n`;
}

function normalizeButtonLabel(value: unknown, fallback: string): string {
	const label = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 8);
	return label || fallback;
}

function normalizeLanguageSetting(value: string | undefined): KotonohaLanguageSetting {
	if (value === "ja" || value === "en" || value === "auto") return value;
	return DEFAULT_SETTINGS.language;
}

function getDisplayLanguage(setting: KotonohaLanguageSetting): KotonohaLanguage {
	if (setting === "ja" || setting === "en") return setting;
	return moment.locale().toLowerCase().startsWith("ja") ? "ja" : "en";
}

function translate(key: TranslationKey, language: KotonohaLanguage, params: Record<string, string | number>): string {
	const template = TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
	return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}

function normalizeSaveTarget(value: string | undefined): SaveTarget {
	if (value === "daily" || value === "monthly" || value === "default") return value;
	return "default";
}

function normalizeTaskStatus(value: string | undefined): TaskStatus | undefined {
	if (value === "open" || value === "todo" || value === "unchecked") return "open";
	if (value === "done" || value === "completed" || value === "checked") return "done";
	if (value === "none" || value === "memo") return "none";
	return undefined;
}

function inferDateFromPath(path: string): string {
	const daily = path.match(/(\d{4}-\d{2}-\d{2})/);
	if (daily) return daily[1];
	const monthly = path.match(/(\d{4}-\d{2})/);
	if (monthly) return `${monthly[1]}-01`;
	return "0000-00-00";
}

function inferFolderFromDateFormat(format: string | undefined): string {
	const normalizedFormat = normalizePath((format || DEFAULT_SETTINGS.dailyNoteFileFormat).trim());
	if (!normalizedFormat.includes("/")) return "";
	return normalizeOptionalFolder(normalizedFormat.split("/").slice(0, -1).join("/"));
}

function isLikelyDailyNotePath(filePath: string, format: string | undefined): boolean {
	const withoutExtension = filePath.replace(/\.md$/i, "");
	const baseName = withoutExtension.split("/").pop() ?? withoutExtension;
	const candidates = Array.from(new Set([withoutExtension, baseName]));
	const configuredFormat = (format || DEFAULT_SETTINGS.dailyNoteFileFormat).trim();

	if (configuredFormat) {
		for (const candidate of candidates) {
			if (moment(candidate, configuredFormat, true).isValid()) return true;
		}
	}

	return /(?:^|\/)\d{4}-\d{2}-\d{2}(?:[_\s-][^/]*)?$/.test(withoutExtension);
}

function formatDateGroupLabel(date: string, language: KotonohaLanguage): string {
	const day = moment(date, "YYYY-MM-DD");
	if (!day.isValid()) return date;
	if (day.isSame(moment(), "day")) return translate("today", language, {});
	if (day.isSame(moment().subtract(1, "day"), "day")) return translate("yesterday", language, {});
	return language === "ja" ? day.format("M月D日 ddd") : day.format("MMM D, ddd");
}

function extractTags(content: string): string[] {
	const matches = content.match(/#[\p{L}\p{N}_/-]+/gu) ?? [];
	return Array.from(new Set(matches));
}

function extractTaskInput(content: string): { content: string; taskStatus: TaskStatus } {
	const match = content.match(/^(?:-\s*)?\[([ xX])\]\s+([\s\S]+)$/);
	if (!match) return { content, taskStatus: "none" };
	return {
		content: match[2].trim(),
		taskStatus: match[1].toLowerCase() === "x" ? "done" : "open",
	};
}

function sanitizeAttachmentName(fileName: string): string {
	const sanitized = fileName
		.trim()
		.replace(/[\\/:*?"<>|#^[\]]+/g, "-")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.slice(0, 120);
	return sanitized || `attachment-${Date.now()}`;
}

function parseMemoBody(raw: string): { content: string; status: MemoStatus; pinned: boolean; storageId: string | null } {
	let status: MemoStatus = "active";
	let pinned = false;
	let storageId: string | null = null;
	const content = raw.replace(META_RE, (_all, body: string) => {
		if (body.includes("status=archived")) status = "archived";
		if (body.includes("status=deleted")) status = "deleted";
		if (body.includes("pinned=true")) pinned = true;
		const idMatch = body.match(/(?:^|;)\s*id=([a-zA-Z0-9_-]+)/);
		if (idMatch) storageId = idMatch[1];
		return "";
	}).trim();
	return { content, status, pinned, storageId };
}

function parseMemoMeta(raw: string): { status: MemoStatus; pinned: boolean; storageId: string | null } {
	const parsed = parseMemoBody(raw);
	return { status: parsed.status, pinned: parsed.pinned, storageId: parsed.storageId };
}

function serializeMemoBlock(storageId: string | null, timestampText: string, content: string, status: MemoStatus, pinned: boolean, taskStatus: TaskStatus): string {
	const metaParts: string[] = [];
	const needsMetadata = status !== "active" || pinned;
	if (storageId && needsMetadata) metaParts.push(`id=${storageId}`);
	if (status !== "active") metaParts.push(`status=${status}`);
	if (pinned) metaParts.push("pinned=true");
	const escaped = content.trim().replace(/\n/g, "\n  ");
	const checkbox = taskStatus === "open" ? "[ ] " : taskStatus === "done" ? "[x] " : "";
	const memoLine = `- ${checkbox}${timestampText} ${escaped}`;
	return metaParts.length > 0 ? `${memoLine}\n  %% kotonoha:${metaParts.join(";")} %%` : memoLine;
}

function memoId(filePath: string, startLine: number, createdAt: string): string {
	return `${createdAt}:${filePath}:${startLine}`;
}

function generateMemoId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getHeadingSectionRange(lines: string[], heading: string): { start: number; end: number } | null {
	const title = normalizeHeadingText(heading) || DEFAULT_SETTINGS.dailyHeading;
	const headingIndex = lines.findIndex((line) => normalizeMarkdownHeading(line) === title);
	if (headingIndex === -1) return null;
	const level = lines[headingIndex].match(/^(#{1,6})\s+/)?.[1].length ?? 6;
	let end = lines.length;
	for (let index = headingIndex + 1; index < lines.length; index += 1) {
		const nextLevel = lines[index].match(/^(#{1,6})\s+/)?.[1].length;
		if (nextLevel && nextLevel <= level) {
			end = index;
			break;
		}
	}
	return { start: headingIndex + 1, end };
}

function parseMemoItems(raw: string, filePath: string, heading: string | null): MemoItem[] {
	const lines = raw.split(/\r?\n/);
	const range = heading ? getHeadingSectionRange(lines, heading) : { start: 0, end: lines.length };
	if (!range) return [];
	const items: MemoItem[] = [];

	for (let index = range.start; index < range.end; index += 1) {
		const startLine = index;
		const match = lines[index].match(/^- (?:\[([ xX])\] )?(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}:\d{2})\s+(.+)$/);
		if (!match) continue;

		const taskStatus: TaskStatus = match[1] ? (match[1].toLowerCase() === "x" ? "done" : "open") : "none";
		const date = match[2] ?? inferDateFromPath(filePath);
		const timestampText = match[2] ? `${match[2]} ${match[3]}` : match[3];
		const createdAt = `${date} ${match[3]}`;
		const contentLines = [match[4]];
		const metaLines: string[] = [];
		let cursor = index + 1;
		while (cursor < range.end && lines[cursor].startsWith("  ")) {
			const childLine = lines[cursor].slice(2);
			if (META_LINE_RE.test(childLine)) {
				metaLines.push(childLine);
			} else {
				contentLines.push(childLine);
			}
			cursor += 1;
		}
		index = cursor - 1;

		const parsed = parseMemoBody(contentLines.join("\n"));
		const childMeta = metaLines.map(parseMemoMeta);
		const storageId = childMeta.find((meta) => meta.storageId)?.storageId ?? parsed.storageId;
		const status = childMeta.find((meta) => meta.status !== "active")?.status ?? parsed.status;
		const pinned = parsed.pinned || childMeta.some((meta) => meta.pinned);
		const createdTime = moment(createdAt, "YYYY-MM-DD HH:mm").valueOf();
		items.push({
			id: storageId ?? memoId(filePath, startLine, createdAt),
			storageId,
			filePath,
			startLine,
			endLine: cursor - 1,
			timestampText,
			createdAt,
			createdTime: Number.isNaN(createdTime) ? 0 : createdTime,
			content: parsed.content,
			tags: extractTags(parsed.content),
			status,
			pinned,
			taskStatus,
		});
	}
	return items;
}

function formatMemoMetaTime(memo: MemoItem): string {
	if (memo.createdAt.startsWith(moment().format("YYYY-MM-DD"))) return memo.timestampText.replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
	return memo.createdAt;
}

function findCurrentMemo(raw: string, memo: MemoItem, heading: string | null): MemoItem | null {
	const candidates = parseMemoItems(raw, memo.filePath, heading);
	if (memo.storageId) {
		return candidates.find((candidate) => candidate.storageId === memo.storageId) ?? null;
	}
	const matches = candidates.filter((candidate) =>
		candidate.createdAt === memo.createdAt &&
		candidate.content === memo.content &&
		candidate.taskStatus === memo.taskStatus &&
		candidate.status === memo.status &&
		candidate.pinned === memo.pinned
	);
	return matches.length === 1 ? matches[0] : null;
}

function removeRedundantMetadata(raw: string, heading: string | null): string {
	const lines = raw.split(/\r?\n/);
	const range = heading ? getHeadingSectionRange(lines, heading) : { start: 0, end: lines.length };
	if (!range) return raw;

	for (let index = range.end - 1; index >= range.start; index -= 1) {
		const match = lines[index].match(META_LINE_RE);
		if (!match) continue;
		const body = match[1];
		if (body.includes("status=") || body.includes("pinned=true")) continue;
		lines.splice(index, 1);
	}

	return lines.join("\n");
}

function upsertUnderHeading(raw: string, heading: string, memoLine: string, insertAtTop: boolean): string {
	const title = normalizeHeadingText(heading) || DEFAULT_SETTINGS.dailyHeading;
	const headingLine = `## ${title}`;
	const lines = raw.split(/\r?\n/);
	const headingIndex = lines.findIndex((line) => normalizeMarkdownHeading(line) === title);

	if (headingIndex === -1) {
		const prefix = raw.endsWith("\n") ? raw : `${raw}\n`;
		return `${prefix}\n${headingLine}\n${memoLine}\n`;
	}

	if (insertAtTop) {
		lines.splice(headingIndex + 1, 0, memoLine);
		return lines.join("\n");
	}

	let insertAt = lines.length;
	for (let index = headingIndex + 1; index < lines.length; index += 1) {
		if (/^#{1,6}\s+/.test(lines[index])) {
			insertAt = index;
			break;
		}
	}

	lines.splice(insertAt, 0, memoLine);
	return lines.join("\n");
}

function normalizeMarkdownHeading(line: string): string | null {
	const match = line.trim().match(/^#{1,6}\s+(.+?)\s*#*$/);
	if (!match) return null;
	return normalizeHeadingText(match[1]);
}

export {
	findCurrentMemo,
	isLikelyDailyNotePath,
	parseMemoItems,
	normalizeFolder,
	normalizeOptionalFolder,
	serializeMemoBlock,
	upsertUnderHeading,
};

import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = resolve(import.meta.dirname, "../..");
const port = Number(process.env.PORT || 8095);
const screenshotPath = join(root, "tests/ui/artifacts/kotonoha-mobile.png");
const execFileAsync = promisify(execFile);

async function startServer() {
  const types = {
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
  };
  const server = createServer(async (request, response) => {
    const requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = requestedPath === "/" ? "tests/ui/kotonoha-mobile.html" : requestedPath.replace(/^\/+/, "");
    const filePath = normalize(join(root, relativePath));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
  return server;
}

async function main() {
	let chromium;
	try {
		({ chromium } = await import("playwright"));
	} catch {
		await runWithChrome();
		return;
	}

  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/tests/ui/kotonoha-mobile.html`);
    const result = await page.evaluate(() => {
      const capture = document.querySelector("[data-testid='capture']")?.getBoundingClientRect();
      const list = document.querySelector("[data-testid='memo-list']")?.getBoundingClientRect();
      const primary = document.querySelector(".kotonoha-primary-button")?.getBoundingClientRect();
      const actions = document.querySelector(".kotonoha-actions");
      const search = document.querySelector(".kotonoha-search");
      const controls = document.querySelector(".kotonoha-control-stack");
      const toolbar = document.querySelector(".mobile-browser-bar")?.getBoundingClientRect();
      const actionLabels = Array.from(document.querySelectorAll(".kotonoha-actions button")).map((button) => button.textContent);

      return {
        capture,
        list,
        hasAdvancedControls: Boolean(search || controls),
        hasPrimarySaveButton: actionLabels.includes("残す"),
        hasRightPrimaryAction: actionLabels.at(-1) === "残す",
        primaryButtonVisible: Boolean(primary && primary.left >= 0 && primary.right <= window.innerWidth),
        hasTaskButton: actionLabels.includes("タスク"),
        hasAttachButton: actionLabels.includes("添付"),
        hasOnlyPrimaryActions: actionLabels.length === 3,
        actionsNoHorizontalOverflow: Boolean(actions && actions.scrollWidth <= actions.clientWidth + 1),
        cardActionsCompact: Array.from(document.querySelectorAll(".kotonoha-card-actions")).every((cardActions) => cardActions.querySelectorAll("button").length <= 1),
        filePathHidden: document.querySelectorAll(".kotonoha-meta a").length === 0,
        saveTargetHidden: document.querySelectorAll(".kotonoha-control-row").length === 0,
        taskIndicatorsVisible: document.querySelectorAll(".kotonoha-task-indicator").length === 2,
        dateGroupsVisible: document.querySelectorAll(".kotonoha-date-heading").length === 3,
        captureAboveBottomToolbar: Boolean(capture && toolbar && capture.bottom <= toolbar.top - 8),
        listBelowStatusBar: Boolean(list && list.top >= 52),
      };
    });

    const failures = [];
    if (result.hasAdvancedControls) failures.push("検索/詳細フィルターがデフォルト表示されています。");
    if (!result.captureAboveBottomToolbar) failures.push("入力欄が下部バーに近すぎます。");
    if (!result.listBelowStatusBar) failures.push("一覧上部がステータスバーに近すぎます。");
    if (!result.hasPrimarySaveButton) failures.push("主ボタンが「残す」になっていません。");
    if (!result.hasRightPrimaryAction) failures.push("主ボタンが右端にありません。");
    if (!result.primaryButtonVisible) failures.push("主ボタンが画面内に収まっていません。");
    if (!result.hasTaskButton) failures.push("タスクボタンが表示されていません。");
    if (!result.hasAttachButton) failures.push("添付ボタンが表示されていません。");
    if (!result.hasOnlyPrimaryActions) failures.push("通常表示の操作ボタンが多すぎます。");
    if (!result.actionsNoHorizontalOverflow) failures.push("操作ボタン列が横にはみ出しています。");
    if (!result.cardActionsCompact) failures.push("カード操作ボタンが多すぎます。");
    if (!result.filePathHidden) failures.push("通常表示でファイルパスが表示されています。");
    if (!result.saveTargetHidden) failures.push("通常表示で保存先切替が表示されています。");
    if (!result.taskIndicatorsVisible) failures.push("タスク状態が一覧に表示されていません。");
    if (!result.dateGroupsVisible) failures.push("日付グループが一覧に表示されていません。");

    await mkdir(join(root, "tests/ui/artifacts"), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (failures.length > 0) {
      console.error(JSON.stringify(result, null, 2));
      throw new Error(failures.join("\n"));
    }

    console.log(`UI layout check passed. Screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

function findChrome() {
	const candidates = [
		process.env.CHROME_BIN,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	].filter(Boolean);
	return candidates.find((candidate) => existsSync(candidate));
}

async function runWithChrome() {
	const chrome = findChrome();
	if (!chrome) {
		console.log("Playwright and Chrome/Chromium were not found. Run `npm run ui:serve` and open the printed URL for manual visual checks.");
		return;
	}

	const server = await startServer();
	await mkdir(join(root, "tests/ui/artifacts"), { recursive: true });
	try {
		const url = `http://127.0.0.1:${port}/tests/ui/kotonoha-mobile.html`;
		await execFileAsync(chrome, [
			"--headless=new",
			"--disable-gpu",
			"--hide-scrollbars",
			"--no-first-run",
			"--no-default-browser-check",
			"--window-size=393,852",
			`--screenshot=${screenshotPath}`,
			url,
		]);
		const { stdout } = await execFileAsync(chrome, [
			"--headless=new",
			"--disable-gpu",
			"--hide-scrollbars",
			"--no-first-run",
			"--no-default-browser-check",
			"--window-size=393,852",
			"--dump-dom",
			url,
		], { maxBuffer: 1024 * 1024 * 4 });
		const match = stdout.match(new RegExp('<script id="kotonoha-layout-result" type="application/json">([^<]+)</script>'));
		if (!match) throw new Error("レイアウト検査結果をHTMLから取得できませんでした。");
		const result = JSON.parse(match[1]);
		const failures = [];
		if (result.hasAdvancedControls) failures.push("検索/詳細フィルターがデフォルト表示されています。");
		if (!result.captureAboveBottomToolbar) failures.push("入力欄が下部バーに近すぎます。");
		if (!result.listBelowStatusBar) failures.push("一覧上部がステータスバーに近すぎます。");
		if (!result.hasPrimarySaveButton) failures.push("主ボタンが「残す」になっていません。");
		if (!result.hasRightPrimaryAction) failures.push("主ボタンが右端にありません。");
		if (!result.primaryButtonVisible) failures.push("主ボタンが画面内に収まっていません。");
		if (!result.hasTaskButton) failures.push("タスクボタンが表示されていません。");
		if (!result.hasAttachButton) failures.push("添付ボタンが表示されていません。");
		if (!result.hasOnlyPrimaryActions) failures.push("通常表示の操作ボタンが多すぎます。");
		if (!result.actionsNoHorizontalOverflow) failures.push("操作ボタン列が横にはみ出しています。");
		if (!result.cardActionsCompact) failures.push("カード操作ボタンが多すぎます。");
		if (!result.filePathHidden) failures.push("通常表示でファイルパスが表示されています。");
		if (!result.saveTargetHidden) failures.push("通常表示で保存先切替が表示されています。");
		if (!result.taskIndicatorsVisible) failures.push("タスク状態が一覧に表示されていません。");
		if (!result.dateGroupsVisible) failures.push("日付グループが一覧に表示されていません。");
		if (failures.length > 0) {
			console.error(JSON.stringify(result, null, 2));
			throw new Error(failures.join("\n"));
		}
		console.log(`UI screenshot captured with Chrome. Screenshot: ${screenshotPath}`);
	} finally {
		await new Promise((resolveClose) => server.close(resolveClose));
	}
}

await main();

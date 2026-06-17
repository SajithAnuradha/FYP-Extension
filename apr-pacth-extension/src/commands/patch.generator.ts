import * as path from "node:path";
import * as vscode from "vscode";
import { requestPatch } from "../services/api.client.service";
import {
	applyPatchToSelection,
	getSelectionData,
	getSelectionDataForDocumentRange,
} from "../services/editor.service";
import { buildGeneratePatchRequest } from "../services/request-builder.service";
import {
	getMaxPatchAttempts,
	runTests,
	type TestExecutionConfig,
} from "../services/test-runner.service";
import { ChatPanel } from "../ui/chat.panel";

function formatFailureForFeedback(testOutput: string): string {
	const normalized = testOutput.trim();
	if (!normalized) {
		return "The test command failed without output.";
	}
	return normalized.length <= 500 ? normalized : `...${normalized.slice(-500)}`;
}

function buildFeedback(userFeedback: string, testFailureOutput?: string): string {
	if (!testFailureOutput) {
		return userFeedback;
	}
	return [userFeedback, "", "Latest failing test output:", testFailureOutput].join("\n");
}

async function resolveTestPath(
	input: string,
	workspaceFolder: vscode.WorkspaceFolder,
): Promise<string | undefined> {
	const resolved = path.isAbsolute(input)
		? path.normalize(input)
		: path.resolve(workspaceFolder.uri.fsPath, input);

	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(resolved));
		return resolved;
	} catch {
		return undefined;
	}
}

async function detectTestCommand(workspaceFolder: vscode.WorkspaceFolder): Promise<string> {
	const root = workspaceFolder.uri.fsPath;
	const candidates: Array<[string, string]> = [
		["pom.xml", "mvn test -Dtest=\"$(basename {testFile} .java)\""],
		["build.gradle", "gradle test --tests {testFile}"],
		["build.gradle.kts", "gradle test --tests {testFile}"],
	];
	for (const [file, cmd] of candidates) {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(path.join(root, file)));
			return cmd;
		} catch {
			// not found, try next
		}
	}
	return "";
}

async function collectTestConfig(
	chat: ChatPanel,
	documentUri: vscode.Uri,
): Promise<TestExecutionConfig | undefined> {
	const workspaceFolder =
		vscode.workspace.getWorkspaceFolder(documentUri) ??
		vscode.workspace.workspaceFolders?.[0];

	if (!workspaceFolder) {
		return undefined;
	}

	const config = vscode.workspace.getConfiguration("apr");
	const defaultPath = config.get<string>("defaultTestFilePath", "");
	const defaultCmd = config.get<string>("testCommand", "");

	const pathHint = defaultPath ? ` (press Enter to use default: ${defaultPath})` : "";
	const skipNote = defaultPath ? "" : " Leave empty and press Enter to skip testing.";
	const testFileInput = await chat.waitForInput(
		`Optional: Enter the test file path to validate the patch${pathHint}.${skipNote}`,
	);

	if (testFileInput === null) {
		return undefined;
	}

	const rawPath = testFileInput || defaultPath;
	if (!rawPath) {
		return undefined;
	}

	const resolvedPath = await resolveTestPath(rawPath, workspaceFolder);
	if (!resolvedPath) {
		chat.addMessage("error", `Could not find test file: "${rawPath}". Proceeding without tests.`);
		return undefined;
	}

	const suggestedCmd = defaultCmd || (await detectTestCommand(workspaceFolder));
	const cmdHint = defaultCmd ? ` (press Enter to use default: ${defaultCmd})` : "";
	const commandInput = await chat.waitForInput(
		`Enter the test command. Use {testFile} as a placeholder${cmdHint}.\nExample: npm test -- {testFile}`,
		suggestedCmd,
	);

	if (commandInput === null) {
		return undefined;
	}

	const rawCmd = commandInput || defaultCmd;
	if (!rawCmd) {
		chat.addMessage("error", "No test command provided. Proceeding without tests.");
		return undefined;
	}
	if (!rawCmd.includes("{testFile}")) {
		chat.addMessage(
			"error",
			`Command must include {testFile}. Proceeding without tests.`,
		);
		return undefined;
	}

	return {
		command: rawCmd,
		resolvedTestFilePath: resolvedPath,
		testFileInput: rawPath,
		workspaceFolder,
	};
}

export async function generatePatchCommand(context: vscode.ExtensionContext): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("APR: No active editor found.");
		return;
	}

	const selectionData = getSelectionData(editor);
	if (!selectionData) {
		vscode.window.showErrorMessage("APR: Select the buggy code range first.");
		return;
	}

	const chat = ChatPanel.createOrShow(context);
	const documentUri = editor.document.uri;

	chat.addMessage(
		"status",
		`File: ${selectionData.fileName}  ·  Lines ${selectionData.startLine + 1}–${selectionData.endLine + 1}`,
	);
	chat.addMessage("code", selectionData.selectedText);

	const feedback = await chat.waitForInput(
		"Describe what is wrong with the selected code and what the fix should do:",
	);
	if (feedback === null) {
		return;
	}
	if (!feedback) {
		chat.addMessage("error", "A description is required. Please restart the command.");
		return;
	}

	const testConfig = await collectTestConfig(chat, documentUri);
	const maxAttempts = testConfig ? getMaxPatchAttempts() : 1;

	let currentFeedback = feedback;
	let currentRange = selectionData.range;
	let lastFailureOutput: string | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		chat.setStatus(
			testConfig
				? `Attempt ${attempt}/${maxAttempts}: generating patch…`
				: "Generating patch…",
		);

		const currentSelectionData = await getSelectionDataForDocumentRange(
			documentUri,
			currentRange,
		);
		if (!currentSelectionData) {
			chat.addMessage("error", "Unable to read selected code. Was the file modified?");
			chat.setStatus("");
			return;
		}

		let response;
		try {
			const payload = buildGeneratePatchRequest(
				currentSelectionData,
				buildFeedback(currentFeedback, lastFailureOutput),
			);
			response = await requestPatch(payload);
		} catch (err) {
			chat.addMessage(
				"error",
				`Backend error: ${err instanceof Error ? err.message : String(err)}`,
			);
			chat.setStatus("");
			return;
		}

		if (!response.patches.length) {
			chat.addMessage("error", "No patch candidates returned by the backend.");
			chat.setStatus("");
			return;
		}

		const bestPatch = response.patches[0];
		chat.addMessage("patch", bestPatch.patchedText);

		const appliedRange = await applyPatchToSelection(
			documentUri,
			currentRange,
			bestPatch.patchedText,
		);

		if (!appliedRange) {
			chat.addMessage("error", "Failed to apply patch to the editor.");
			chat.setStatus("");
			return;
		}
		currentRange = appliedRange;

		if (!testConfig) {
			await vscode.workspace.openTextDocument(documentUri).then(doc => doc.save());
			chat.addMessage("success", "Patch applied successfully.");
			chat.setStatus("");
			return;
		}

		chat.setStatus(`Attempt ${attempt}/${maxAttempts}: running tests…`);
		const testResult = await runTests(testConfig);

		if (testResult.passed) {
			await vscode.workspace.openTextDocument(documentUri).then(doc => doc.save());
			chat.addMessage("success", "Tests passed! Patch applied successfully.");
			if (testResult.output) {
				chat.addMessage("status", `Test output:\n${testResult.output}`);
			}
			chat.setStatus("");
			return;
		}

		lastFailureOutput = formatFailureForFeedback(testResult.output);
		chat.addMessage(
			"error",
			`Attempt ${attempt}/${maxAttempts}: tests failed (exit code ${testResult.exitCode ?? "unknown"}).\n\n${lastFailureOutput}`,
		);

		if (attempt === maxAttempts) {
			chat.addMessage(
				"error",
				`Tests still failing after ${maxAttempts} attempts. The last patch has been applied — check the test output above.`,
			);
			chat.setStatus("");
			return;
		}

		const nextFeedback = await chat.waitForInput(
			`Attempt ${attempt} failed. Add more detail for the next attempt, or press Enter to retry with the same description (close the panel to cancel):`,
		);
		if (nextFeedback === null) {
			chat.addMessage("status", "Patch retry cancelled.");
			chat.setStatus("");
			return;
		}
		if (nextFeedback) {
			currentFeedback = nextFeedback;
		}
	}

	chat.setStatus("");
}

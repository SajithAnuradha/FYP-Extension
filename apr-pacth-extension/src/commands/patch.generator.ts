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
	getTestExecutionConfig,
	runTests,
} from "../services/test-runner.service";
import { getNaturalLanguageFeedback } from "../ui/feedback-input";
import {
	showError,
	showInfo,
	showTestFailure,
	showTestPass,
} from "../ui/notification";

function formatFailureForFeedback(testOutput: string): string {
	const normalized = testOutput.trim();
	if (!normalized) {
		return "The test command failed without output.";
	}

	if (normalized.length <= 500) {
		return normalized;
	}

	return `...${normalized.slice(-500)}`;
}

function buildFeedback(
	userFeedback: string,
	testFailureOutput?: string,
): string {
	if (!testFailureOutput) {
		return userFeedback;
	}

	return [
		userFeedback,
		"",
		"Latest failing test output:",
		testFailureOutput,
	].join("\n");
}

function buildFailureMessage(
	attempt: number,
	maxAttempts: number,
	testResultOutput: string,
	exitCode: number | null,
): string {
	const summary = formatFailureForFeedback(testResultOutput);
	return [
		`Attempt ${attempt} of ${maxAttempts}: tests failed.`,
		`Exit code: ${exitCode ?? "unknown"}.`,
		summary,
	].join(" ");
}

export async function generatePatchCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		showError("No active editor found.");
		return;
	}

	const selectionData = getSelectionData(editor);
	if (!selectionData) {
		showError("Please select the buggy line or code range first.");
		return;
	}
	const documentUri = editor.document.uri;

	const testExecutionConfig = await getTestExecutionConfig(editor.document.uri);
	if (!testExecutionConfig) {
		showError("Patch generation cancelled.");
		return;
	}

	const initialFeedback = await getNaturalLanguageFeedback();
	if (!initialFeedback) {
		showError("Patch generation cancelled.");
		return;
	}
	let feedback = initialFeedback;

	const maxAttempts = getMaxPatchAttempts();

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "Generating patch and validating tests...",
			cancellable: false,
		},
		async (progress) => {
			try {
				let currentRange = selectionData.range;
				let lastFailureOutput: string | undefined;

				for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
					progress.report({
						message: `Attempt ${attempt} of ${maxAttempts}: generating patch`,
					});

					const currentSelectionData = await getSelectionDataForDocumentRange(
						documentUri,
						currentRange,
					);
					if (!currentSelectionData) {
						showError("Unable to rebuild the selected code for patch generation.");
						return;
					}

					const payload = buildGeneratePatchRequest(
						currentSelectionData,
						buildFeedback(feedback, lastFailureOutput),
					);
					const response = await requestPatch(payload);

					if (!response.patches.length) {
						showError("No patch candidates were returned by the backend.");
						return;
					}

					const bestPatch = response.patches[0];
					const appliedRange = await applyPatchToSelection(
						documentUri,
						currentRange,
						bestPatch.patchedText,
					);

					if (!appliedRange) {
						showError("Failed to apply patch.");
						return;
					}

					currentRange = appliedRange;

					progress.report({
						message: `Attempt ${attempt} of ${maxAttempts}: running tests`,
					});

					const testResult = await runTests(testExecutionConfig);
					if (testResult.passed) {
						showTestPass(
							`Patch applied successfully and tests passed. Confidence: ${bestPatch.confidence}`,
							testResult.output,
						);
						return;
					}

					lastFailureOutput = formatFailureForFeedback(testResult.output);
					await showTestFailure(
						buildFailureMessage(
							attempt,
							maxAttempts,
							testResult.output,
							testResult.exitCode,
						),
						testResult.output,
					);

					if (attempt === maxAttempts) {
						showError(
							`Patch applied, but tests still failed after ${maxAttempts} attempts. See test output for failure details.`,
						);
						return;
					}

					const nextFeedback = await getNaturalLanguageFeedback({
						attempt: attempt + 1,
						testFailureOutput: lastFailureOutput,
					});
					if (!nextFeedback) {
						showError("Patch retry cancelled after test failure.");
						return;
					}
					feedback = nextFeedback;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				showError(`Patch generation failed: ${message}`);
			}
		},
	);
}

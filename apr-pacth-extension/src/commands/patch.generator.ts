import * as vscode from "vscode";
import { requestPatch } from "../services/api.client.service";
import {
	applyPatchToSelection,
	getSelectionData,
} from "../services/editor.service";
import { buildGeneratePatchRequest } from "../services/request-builder.service";
import { getNaturalLanguageFeedback } from "../ui/feedback-input";
import { showError,showInfo } from "../ui/notification";

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

	const feedback = await getNaturalLanguageFeedback();
	if (!feedback) {
		showError("Patch generation cancelled.");
		return;
	}

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "Generating patch...",
			cancellable: false,
		},
		async () => {
			try {
				const payload = buildGeneratePatchRequest(selectionData, feedback);
				const response = await requestPatch(payload);

				if (!response.patches.length) {
					showError("No patch candidates were returned by the backend.");
					return;
				}

				const bestPatch = response.patches[0];
				const applied = await applyPatchToSelection(
					editor,
					selectionData.range,
					bestPatch.patchedText,
				);

				if (!applied) {
					showError("Failed to apply patch.");
					return;
				}

				showInfo(
					`Patch applied successfully. Confidence: ${bestPatch.confidence}`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				showError(`Patch generation failed: ${message}`);
			}
		},
	);
}
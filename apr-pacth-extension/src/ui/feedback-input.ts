import * as vscode from "vscode";

interface NaturalLanguageFeedbackOptions {
	attempt?: number;
	testFailureOutput?: string;
}

function buildPrompt(options?: NaturalLanguageFeedbackOptions): string {
	if (options?.testFailureOutput) {
		return `Tests failed after attempt ${options.attempt}. Describe how the next patch should change.`;
	}

	return "Describe what is wrong and what the patch should do";
}

function buildPlaceHolder(options?: NaturalLanguageFeedbackOptions): string {
	if (options?.testFailureOutput) {
		return `Previous failure: ${options.testFailureOutput}`;
	}

	return "Example: Need to also handle empty dataset";
}

export async function getNaturalLanguageFeedback(
	options?: NaturalLanguageFeedbackOptions,
): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: buildPrompt(options),
		placeHolder: buildPlaceHolder(options),
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value.trim()) {
				return "Natural language feedback is required.";
			}
			return null;
		},
	});
}

import * as vscode from "vscode";

export async function getNaturalLanguageFeedback(): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: "Describe what is wrong and what the patch should do",
		placeHolder: "Example: Need to also handle empty dataset",
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value.trim()) {
				return "Natural language feedback is required.";
			}
			return null;
		},
	});
}


import * as vscode from "vscode";

const aprOutputChannel = vscode.window.createOutputChannel("APR Patch Extension");

export function showInfo(message: string): void {
	void vscode.window.showInformationMessage(message);
}

export function showError(message: string): void {
	void vscode.window.showErrorMessage(message);
}

export function showTestPass(message: string, output: string): void {
	aprOutputChannel.clear();
	aprOutputChannel.appendLine("APR test run");
	aprOutputChannel.appendLine("");
	aprOutputChannel.appendLine(output || "Tests passed without additional output.");
	void vscode.window.showInformationMessage(message, "Show Test Output").then((action) => {
		if (action === "Show Test Output") {
			aprOutputChannel.show(true);
		}
	});
}

export async function showTestFailure(
	message: string,
	output: string,
): Promise<void> {
	aprOutputChannel.clear();
	aprOutputChannel.appendLine("APR test failure");
	aprOutputChannel.appendLine("");
	aprOutputChannel.appendLine(output || "No test output was produced.");

	const action = await vscode.window.showErrorMessage(
		message,
		"Show Test Output",
	);

	if (action === "Show Test Output") {
		aprOutputChannel.show(true);
	}
}

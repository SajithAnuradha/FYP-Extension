import * as vscode from "vscode";

export function showInfo(message: string): void {
	void vscode.window.showInformationMessage(message);
}

export function showError(message: string): void {
	void vscode.window.showErrorMessage(message);
}
import * as vscode from "vscode";
import { generatePatchCommand } from "../commands/patch.generator";

export function activate(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"apr.generatePatch",
		generatePatchCommand,
	);

	context.subscriptions.push(disposable);
}

export function deactivate(): void {}
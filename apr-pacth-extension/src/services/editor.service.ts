import * as vscode from "vscode";

export interface EditorSelectionData {
	fileName: string;
	language: string;
	startLine: number;
	endLine: number;
	selectedText: string;
	contextBefore: string;
	contextAfter: string;
	range: vscode.Range;
}

function collectLines(
	document: vscode.TextDocument,
	startLine: number,
	endLine: number,
): string {
	if (startLine > endLine) {
		return "";
	}

	const lines: string[] = [];
	for (let line = startLine; line <= endLine; line += 1) {
		lines.push(document.lineAt(line).text);
	}
	return lines.join("\n");
}

export function getSelectionData(
	editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor,
): EditorSelectionData | undefined {
	if (!editor) {
		return undefined;
	}

	const document = editor.document;
	const selection = editor.selection;

	if (selection.isEmpty) {
		return undefined;
	}

	const selectedText = document.getText(selection);
	if (!selectedText.trim()) {
		return undefined;
	}

	const startLine = selection.start.line;
	const endLine = selection.end.line;

	const contextBefore = collectLines(
		document,
		Math.max(0, startLine - 3),
		Math.max(0, startLine - 1),
	);

	const contextAfter = collectLines(
		document,
		Math.min(document.lineCount - 1, endLine + 1),
		Math.min(document.lineCount - 1, endLine + 3),
	);

	return {
		fileName: document.fileName.split(/[\\/]/).pop() ?? "unknown",
		language: document.languageId,
		startLine,
		endLine,
		selectedText,
		contextBefore,
		contextAfter,
		range: new vscode.Range(selection.start, selection.end),
	};
}

export async function applyPatchToSelection(
	editor: vscode.TextEditor,
	range: vscode.Range,
	patchedText: string,
): Promise<boolean> {
	return editor.edit((editBuilder) => {
		editBuilder.replace(range, patchedText);
	});
}
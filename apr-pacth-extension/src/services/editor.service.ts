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

function buildSelectionData(
	document: vscode.TextDocument,
	range: vscode.Range,
	selectedText: string,
): EditorSelectionData | undefined {
	if (!selectedText.trim()) {
		return undefined;
	}

	const startLine = range.start.line;
	const endLine = range.end.line;

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
		range,
	};
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

	return getSelectionDataForRange(
		editor,
		new vscode.Range(selection.start, selection.end),
	);
}

export function getSelectionDataForRange(
	editor: vscode.TextEditor,
	range: vscode.Range,
): EditorSelectionData | undefined {
	return buildSelectionData(
		editor.document,
		range,
		editor.document.getText(range),
	);
}

export async function getSelectionDataForDocumentRange(
	documentUri: vscode.Uri,
	range: vscode.Range,
): Promise<EditorSelectionData | undefined> {
	const document = await vscode.workspace.openTextDocument(documentUri);
	return buildSelectionData(document, range, document.getText(range));
}

export async function applyPatchToSelection(
	documentUri: vscode.Uri,
	range: vscode.Range,
	patchedText: string,
) : Promise<vscode.Range | undefined> {
	const document = await vscode.workspace.openTextDocument(documentUri);
	const startOffset = document.offsetAt(range.start);
	const edit = new vscode.WorkspaceEdit();
	edit.replace(documentUri, range, patchedText);
	const applied = await vscode.workspace.applyEdit(edit);

	if (!applied) {
		return undefined;
	}

	const updatedDocument = await vscode.workspace.openTextDocument(documentUri);
	const endPosition = updatedDocument.positionAt(startOffset + patchedText.length);
	return new vscode.Range(range.start, endPosition);
}

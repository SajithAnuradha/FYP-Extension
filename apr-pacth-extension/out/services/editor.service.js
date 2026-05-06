"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSelectionData = getSelectionData;
exports.getSelectionDataForRange = getSelectionDataForRange;
exports.getSelectionDataForDocumentRange = getSelectionDataForDocumentRange;
exports.applyPatchToSelection = applyPatchToSelection;
const vscode = __importStar(require("vscode"));
function buildSelectionData(document, range, selectedText) {
    if (!selectedText.trim()) {
        return undefined;
    }
    const startLine = range.start.line;
    const endLine = range.end.line;
    const contextBefore = collectLines(document, Math.max(0, startLine - 3), Math.max(0, startLine - 1));
    const contextAfter = collectLines(document, Math.min(document.lineCount - 1, endLine + 1), Math.min(document.lineCount - 1, endLine + 3));
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
function collectLines(document, startLine, endLine) {
    if (startLine > endLine) {
        return "";
    }
    const lines = [];
    for (let line = startLine; line <= endLine; line += 1) {
        lines.push(document.lineAt(line).text);
    }
    return lines.join("\n");
}
function getSelectionData(editor = vscode.window.activeTextEditor) {
    if (!editor) {
        return undefined;
    }
    const document = editor.document;
    const selection = editor.selection;
    if (selection.isEmpty) {
        return undefined;
    }
    return getSelectionDataForRange(editor, new vscode.Range(selection.start, selection.end));
}
function getSelectionDataForRange(editor, range) {
    return buildSelectionData(editor.document, range, editor.document.getText(range));
}
async function getSelectionDataForDocumentRange(documentUri, range) {
    const document = await vscode.workspace.openTextDocument(documentUri);
    return buildSelectionData(document, range, document.getText(range));
}
async function applyPatchToSelection(documentUri, range, patchedText) {
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
//# sourceMappingURL=editor.service.js.map
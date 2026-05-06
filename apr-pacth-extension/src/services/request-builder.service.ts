import { GeneratePatchRequest } from "../types/patch.type";
import { EditorSelectionData } from "./editor.service";

export function buildGeneratePatchRequest(
	selectionData: EditorSelectionData,
	naturalLanguageFeedback?: string,
): GeneratePatchRequest {
	return {
		fileName: selectionData.fileName,
		language: selectionData.language,
		selection: {
			startLine: selectionData.startLine,
			endLine: selectionData.endLine,
			selectedText: selectionData.selectedText,
		},
		context: {
			before: selectionData.contextBefore,
			after: selectionData.contextAfter,
		},
		naturalLanguageFeedback,
	};
}
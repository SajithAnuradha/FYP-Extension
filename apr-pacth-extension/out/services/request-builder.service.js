"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGeneratePatchRequest = buildGeneratePatchRequest;
function buildGeneratePatchRequest(selectionData, naturalLanguageFeedback) {
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
//# sourceMappingURL=request-builder.service.js.map
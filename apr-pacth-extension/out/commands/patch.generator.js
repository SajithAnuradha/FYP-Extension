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
exports.generatePatchCommand = generatePatchCommand;
const vscode = __importStar(require("vscode"));
const api_client_service_1 = require("../services/api.client.service");
const editor_service_1 = require("../services/editor.service");
const request_builder_service_1 = require("../services/request-builder.service");
const feedback_input_1 = require("../ui/feedback-input");
const notification_1 = require("../ui/notification");
async function generatePatchCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        (0, notification_1.showError)("No active editor found.");
        return;
    }
    const selectionData = (0, editor_service_1.getSelectionData)(editor);
    if (!selectionData) {
        (0, notification_1.showError)("Please select the buggy line or code range first.");
        return;
    }
    const feedback = await (0, feedback_input_1.getNaturalLanguageFeedback)();
    if (!feedback) {
        (0, notification_1.showError)("Patch generation cancelled.");
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating patch...",
        cancellable: false,
    }, async () => {
        try {
            const payload = (0, request_builder_service_1.buildGeneratePatchRequest)(selectionData, feedback);
            const response = await (0, api_client_service_1.requestPatch)(payload);
            if (!response.patches.length) {
                (0, notification_1.showError)("No patch candidates were returned by the backend.");
                return;
            }
            const bestPatch = response.patches[0];
            const applied = await (0, editor_service_1.applyPatchToSelection)(editor, selectionData.range, bestPatch.patchedText);
            if (!applied) {
                (0, notification_1.showError)("Failed to apply patch.");
                return;
            }
            (0, notification_1.showInfo)(`Patch applied successfully. Confidence: ${bestPatch.confidence}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            (0, notification_1.showError)(`Patch generation failed: ${message}`);
        }
    });
}
//# sourceMappingURL=patch.generator.js.map
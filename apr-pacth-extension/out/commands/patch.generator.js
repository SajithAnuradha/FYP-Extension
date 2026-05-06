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
const test_runner_service_1 = require("../services/test-runner.service");
const feedback_input_1 = require("../ui/feedback-input");
const notification_1 = require("../ui/notification");
function formatFailureForFeedback(testOutput) {
    const normalized = testOutput.trim();
    if (!normalized) {
        return "The test command failed without output.";
    }
    if (normalized.length <= 500) {
        return normalized;
    }
    return `...${normalized.slice(-500)}`;
}
function buildFeedback(userFeedback, testFailureOutput) {
    if (!testFailureOutput) {
        return userFeedback;
    }
    return [
        userFeedback,
        "",
        "Latest failing test output:",
        testFailureOutput,
    ].join("\n");
}
function buildFailureMessage(attempt, maxAttempts, testResultOutput, exitCode) {
    const summary = formatFailureForFeedback(testResultOutput);
    return [
        `Attempt ${attempt} of ${maxAttempts}: tests failed.`,
        `Exit code: ${exitCode ?? "unknown"}.`,
        summary,
    ].join(" ");
}
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
    const documentUri = editor.document.uri;
    const testExecutionConfig = await (0, test_runner_service_1.getTestExecutionConfig)(editor.document.uri);
    if (!testExecutionConfig) {
        (0, notification_1.showError)("Patch generation cancelled.");
        return;
    }
    const initialFeedback = await (0, feedback_input_1.getNaturalLanguageFeedback)();
    if (!initialFeedback) {
        (0, notification_1.showError)("Patch generation cancelled.");
        return;
    }
    let feedback = initialFeedback;
    const maxAttempts = (0, test_runner_service_1.getMaxPatchAttempts)();
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating patch and validating tests...",
        cancellable: false,
    }, async (progress) => {
        try {
            let currentRange = selectionData.range;
            let lastFailureOutput;
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                progress.report({
                    message: `Attempt ${attempt} of ${maxAttempts}: generating patch`,
                });
                const currentSelectionData = await (0, editor_service_1.getSelectionDataForDocumentRange)(documentUri, currentRange);
                if (!currentSelectionData) {
                    (0, notification_1.showError)("Unable to rebuild the selected code for patch generation.");
                    return;
                }
                const payload = (0, request_builder_service_1.buildGeneratePatchRequest)(currentSelectionData, buildFeedback(feedback, lastFailureOutput));
                const response = await (0, api_client_service_1.requestPatch)(payload);
                if (!response.patches.length) {
                    (0, notification_1.showError)("No patch candidates were returned by the backend.");
                    return;
                }
                const bestPatch = response.patches[0];
                const appliedRange = await (0, editor_service_1.applyPatchToSelection)(documentUri, currentRange, bestPatch.patchedText);
                if (!appliedRange) {
                    (0, notification_1.showError)("Failed to apply patch.");
                    return;
                }
                currentRange = appliedRange;
                progress.report({
                    message: `Attempt ${attempt} of ${maxAttempts}: running tests`,
                });
                const testResult = await (0, test_runner_service_1.runTests)(testExecutionConfig);
                if (testResult.passed) {
                    (0, notification_1.showTestPass)(`Patch applied successfully and tests passed. Confidence: ${bestPatch.confidence}`, testResult.output);
                    return;
                }
                lastFailureOutput = formatFailureForFeedback(testResult.output);
                await (0, notification_1.showTestFailure)(buildFailureMessage(attempt, maxAttempts, testResult.output, testResult.exitCode), testResult.output);
                if (attempt === maxAttempts) {
                    (0, notification_1.showError)(`Patch applied, but tests still failed after ${maxAttempts} attempts. See test output for failure details.`);
                    return;
                }
                const nextFeedback = await (0, feedback_input_1.getNaturalLanguageFeedback)({
                    attempt: attempt + 1,
                    testFailureOutput: lastFailureOutput,
                });
                if (!nextFeedback) {
                    (0, notification_1.showError)("Patch retry cancelled after test failure.");
                    return;
                }
                feedback = nextFeedback;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            (0, notification_1.showError)(`Patch generation failed: ${message}`);
        }
    });
}
//# sourceMappingURL=patch.generator.js.map
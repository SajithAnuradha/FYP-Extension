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
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const api_client_service_1 = require("../services/api.client.service");
const editor_service_1 = require("../services/editor.service");
const request_builder_service_1 = require("../services/request-builder.service");
const test_runner_service_1 = require("../services/test-runner.service");
const chat_panel_1 = require("../ui/chat.panel");
function formatFailureForFeedback(testOutput) {
    const normalized = testOutput.trim();
    if (!normalized) {
        return "The test command failed without output.";
    }
    return normalized.length <= 500 ? normalized : `...${normalized.slice(-500)}`;
}
function buildFeedback(userFeedback, testFailureOutput) {
    if (!testFailureOutput) {
        return userFeedback;
    }
    return [userFeedback, "", "Latest failing test output:", testFailureOutput].join("\n");
}
async function resolveTestPath(input, workspaceFolder) {
    const resolved = path.isAbsolute(input)
        ? path.normalize(input)
        : path.resolve(workspaceFolder.uri.fsPath, input);
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(resolved));
        return resolved;
    }
    catch {
        return undefined;
    }
}
async function collectTestConfig(chat, documentUri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri) ??
        vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return undefined;
    }
    const config = vscode.workspace.getConfiguration("apr");
    const defaultPath = config.get("defaultTestFilePath", "");
    const defaultCmd = config.get("testCommand", "");
    const pathHint = defaultPath ? ` (default: ${defaultPath})` : "";
    const testFileInput = await chat.waitForInput(`Optional: Enter the test file path to validate the patch${pathHint}.\nLeave empty and press Enter to skip testing and apply the patch directly.`);
    if (testFileInput === null) {
        return undefined;
    }
    const rawPath = testFileInput || defaultPath;
    if (!rawPath) {
        return undefined;
    }
    const resolvedPath = await resolveTestPath(rawPath, workspaceFolder);
    if (!resolvedPath) {
        chat.addMessage("error", `Could not find test file: "${rawPath}". Proceeding without tests.`);
        return undefined;
    }
    const cmdHint = defaultCmd ? ` (default: ${defaultCmd})` : "";
    const commandInput = await chat.waitForInput(`Enter the test command. Use {testFile} as a placeholder${cmdHint}.\nExample: npm test -- {testFile}`);
    if (commandInput === null) {
        return undefined;
    }
    const rawCmd = commandInput || defaultCmd;
    if (!rawCmd || !rawCmd.includes("{testFile}")) {
        if (rawCmd) {
            chat.addMessage("error", `Command must include {testFile}. Proceeding without tests.`);
        }
        return undefined;
    }
    return {
        command: rawCmd,
        resolvedTestFilePath: resolvedPath,
        testFileInput: rawPath,
        workspaceFolder,
    };
}
async function generatePatchCommand(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("APR: No active editor found.");
        return;
    }
    const selectionData = (0, editor_service_1.getSelectionData)(editor);
    if (!selectionData) {
        vscode.window.showErrorMessage("APR: Select the buggy code range first.");
        return;
    }
    const chat = chat_panel_1.ChatPanel.createOrShow(context);
    const documentUri = editor.document.uri;
    chat.addMessage("status", `File: ${selectionData.fileName}  ·  Lines ${selectionData.startLine + 1}–${selectionData.endLine + 1}`);
    chat.addMessage("code", selectionData.selectedText);
    const feedback = await chat.waitForInput("Describe what is wrong with the selected code and what the fix should do:");
    if (feedback === null) {
        return;
    }
    if (!feedback) {
        chat.addMessage("error", "A description is required. Please restart the command.");
        return;
    }
    const testConfig = await collectTestConfig(chat, documentUri);
    const maxAttempts = testConfig ? (0, test_runner_service_1.getMaxPatchAttempts)() : 1;
    let currentFeedback = feedback;
    let currentRange = selectionData.range;
    let lastFailureOutput;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        chat.setStatus(testConfig
            ? `Attempt ${attempt}/${maxAttempts}: generating patch…`
            : "Generating patch…");
        const currentSelectionData = await (0, editor_service_1.getSelectionDataForDocumentRange)(documentUri, currentRange);
        if (!currentSelectionData) {
            chat.addMessage("error", "Unable to read selected code. Was the file modified?");
            chat.setStatus("");
            return;
        }
        let response;
        try {
            const payload = (0, request_builder_service_1.buildGeneratePatchRequest)(currentSelectionData, buildFeedback(currentFeedback, lastFailureOutput));
            response = await (0, api_client_service_1.requestPatch)(payload);
        }
        catch (err) {
            chat.addMessage("error", `Backend error: ${err instanceof Error ? err.message : String(err)}`);
            chat.setStatus("");
            return;
        }
        if (!response.patches.length) {
            chat.addMessage("error", "No patch candidates returned by the backend.");
            chat.setStatus("");
            return;
        }
        const bestPatch = response.patches[0];
        chat.addMessage("patch", bestPatch.patchedText);
        if (bestPatch.explanation) {
            chat.addMessage("assistant", `Explanation: ${bestPatch.explanation}`);
        }
        const appliedRange = await (0, editor_service_1.applyPatchToSelection)(documentUri, currentRange, bestPatch.patchedText);
        if (!appliedRange) {
            chat.addMessage("error", "Failed to apply patch to the editor.");
            chat.setStatus("");
            return;
        }
        currentRange = appliedRange;
        if (!testConfig) {
            chat.addMessage("success", "Patch applied successfully.");
            chat.setStatus("");
            return;
        }
        chat.setStatus(`Attempt ${attempt}/${maxAttempts}: running tests…`);
        const testResult = await (0, test_runner_service_1.runTests)(testConfig);
        if (testResult.passed) {
            chat.addMessage("success", "Tests passed! Patch applied successfully.");
            if (testResult.output) {
                chat.addMessage("status", `Test output:\n${testResult.output}`);
            }
            chat.setStatus("");
            return;
        }
        lastFailureOutput = formatFailureForFeedback(testResult.output);
        chat.addMessage("error", `Attempt ${attempt}/${maxAttempts}: tests failed (exit code ${testResult.exitCode ?? "unknown"}).\n\n${lastFailureOutput}`);
        if (attempt === maxAttempts) {
            chat.addMessage("error", `Tests still failing after ${maxAttempts} attempts. The last patch has been applied — check the test output above.`);
            chat.setStatus("");
            return;
        }
        const nextFeedback = await chat.waitForInput(`Attempt ${attempt} failed. Describe how the next patch should change (or close this panel to cancel):`);
        if (nextFeedback === null || !nextFeedback) {
            chat.addMessage("status", "Patch retry cancelled.");
            chat.setStatus("");
            return;
        }
        currentFeedback = nextFeedback;
    }
    chat.setStatus("");
}
//# sourceMappingURL=patch.generator.js.map
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
exports.getMaxPatchAttempts = getMaxPatchAttempts;
exports.getTestExecutionConfig = getTestExecutionConfig;
exports.runTests = runTests;
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
const DEFAULT_TEST_OUTPUT_LIMIT = 4000;
function trimOutput(output, limit = DEFAULT_TEST_OUTPUT_LIMIT) {
    const normalized = output.trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `...${normalized.slice(-limit)}`;
}
function resolveTestFilePath(testFileInput, workspaceFolder) {
    if (path.isAbsolute(testFileInput)) {
        return path.normalize(testFileInput);
    }
    return path.resolve(workspaceFolder.uri.fsPath, testFileInput);
}
function getWorkspaceFolderForDocument(documentUri) {
    return vscode.workspace.getWorkspaceFolder(documentUri)
        ?? vscode.workspace.workspaceFolders?.[0];
}
function getMaxPatchAttempts() {
    const config = vscode.workspace.getConfiguration("apr");
    const configuredValue = config.get("maxPatchAttempts", 3);
    return Math.max(1, configuredValue);
}
async function getTestExecutionConfig(documentUri) {
    const workspaceFolder = getWorkspaceFolderForDocument(documentUri);
    if (!workspaceFolder) {
        throw new Error("Open the project as a workspace folder before running APR patch tests.");
    }
    const config = vscode.workspace.getConfiguration("apr");
    const defaultTestFilePath = config.get("defaultTestFilePath", "");
    const defaultTestCommand = config.get("testCommand", "");
    const testFileInput = await vscode.window.showInputBox({
        prompt: "Enter the test file path to validate the generated patch",
        placeHolder: "Example: src/test/example.spec.ts",
        value: defaultTestFilePath,
        ignoreFocusOut: true,
        validateInput: async (value) => {
            const trimmedValue = value.trim();
            if (!trimmedValue) {
                return "A test file path is required.";
            }
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(resolveTestFilePath(trimmedValue, workspaceFolder)));
                return null;
            }
            catch {
                return "The provided test path does not exist.";
            }
        },
    });
    if (!testFileInput) {
        return undefined;
    }
    const command = await vscode.window.showInputBox({
        prompt: "Enter the test command. Use {testFile} as the test file placeholder.",
        placeHolder: "Example: npm test -- {testFile}",
        value: defaultTestCommand,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.trim()) {
                return "A test command is required.";
            }
            if (!value.includes("{testFile}")) {
                return "Include the {testFile} placeholder so the selected test file is passed to the command.";
            }
            return null;
        },
    });
    if (!command) {
        return undefined;
    }
    return {
        command,
        resolvedTestFilePath: resolveTestFilePath(testFileInput.trim(), workspaceFolder),
        testFileInput: testFileInput.trim(),
        workspaceFolder,
    };
}
const DEFAULT_TEST_TIMEOUT_MS = 120_000;
async function runTests(config) {
    const vsConfig = vscode.workspace.getConfiguration("apr");
    const timeoutMs = vsConfig.get("testTimeoutMs", DEFAULT_TEST_TIMEOUT_MS);
    const command = config.command
        .replaceAll("{testFile}", `"${config.resolvedTestFilePath}"`)
        .replaceAll("{workspaceFolder}", `"${config.workspaceFolder.uri.fsPath}"`);
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(command, {
            cwd: config.workspaceFolder.uri.fsPath,
            env: process.env,
            shell: true,
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            child.kill();
            reject(new Error(`Test command timed out after ${timeoutMs} ms.`));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            reject(new Error(`Failed to run test command: ${error.message}`));
        });
        child.on("close", (exitCode) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            const output = trimOutput([stdout, stderr].filter(Boolean).join("\n"));
            resolve({
                passed: exitCode === 0,
                exitCode,
                output,
                command,
                resolvedTestFilePath: config.resolvedTestFilePath,
            });
        });
    });
}
//# sourceMappingURL=test-runner.service.js.map
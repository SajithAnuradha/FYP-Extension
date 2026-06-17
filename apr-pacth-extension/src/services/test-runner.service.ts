import * as path from "node:path";
import * as vscode from "vscode";
import { spawn } from "node:child_process";

export interface TestExecutionConfig {
	command: string;
	resolvedTestFilePath: string;
	testFileInput: string;
	workspaceFolder: vscode.WorkspaceFolder;
}

export interface TestRunResult {
	passed: boolean;
	exitCode: number | null;
	output: string;
	command: string;
	resolvedTestFilePath: string;
}

const DEFAULT_TEST_OUTPUT_LIMIT = 4000;

function trimOutput(output: string, limit = DEFAULT_TEST_OUTPUT_LIMIT): string {
	const normalized = output.trim();
	if (normalized.length <= limit) {
		return normalized;
	}

	return `...${normalized.slice(-limit)}`;
}

function resolveTestFilePath(
	testFileInput: string,
	workspaceFolder: vscode.WorkspaceFolder,
): string {
	if (path.isAbsolute(testFileInput)) {
		return path.normalize(testFileInput);
	}

	return path.resolve(workspaceFolder.uri.fsPath, testFileInput);
}

function getWorkspaceFolderForDocument(
	documentUri: vscode.Uri,
): vscode.WorkspaceFolder | undefined {
	return vscode.workspace.getWorkspaceFolder(documentUri)
		?? vscode.workspace.workspaceFolders?.[0];
}

export function getMaxPatchAttempts(): number {
	const config = vscode.workspace.getConfiguration("apr");
	const configuredValue = config.get<number>("maxPatchAttempts", 3);
	return Math.max(1, configuredValue);
}

export async function getTestExecutionConfig(
	documentUri: vscode.Uri,
): Promise<TestExecutionConfig | undefined> {
	const workspaceFolder = getWorkspaceFolderForDocument(documentUri);
	if (!workspaceFolder) {
		throw new Error(
			"Open the project as a workspace folder before running APR patch tests.",
		);
	}

	const config = vscode.workspace.getConfiguration("apr");
	const defaultTestFilePath = config.get<string>("defaultTestFilePath", "");
	const defaultTestCommand = config.get<string>("testCommand", "");

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
				await vscode.workspace.fs.stat(
					vscode.Uri.file(resolveTestFilePath(trimmedValue, workspaceFolder)),
				);
				return null;
			} catch {
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

export async function runTests(
	config: TestExecutionConfig,
): Promise<TestRunResult> {
	const vsConfig = vscode.workspace.getConfiguration("apr");
	const timeoutMs = vsConfig.get<number>("testTimeoutMs", DEFAULT_TEST_TIMEOUT_MS);

	const command = config.command
		.replaceAll("{testFile}", `"${config.resolvedTestFilePath}"`)
		.replaceAll("{workspaceFolder}", `"${config.workspaceFolder.uri.fsPath}"`);

	return new Promise<TestRunResult>((resolve, reject) => {
		const child = spawn(command, {
			cwd: config.workspaceFolder.uri.fsPath,
			env: process.env,
			shell: true,
		});

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = setTimeout(() => {
			if (settled) { return; }
			settled = true;
			child.kill();
			reject(new Error(`Test command timed out after ${timeoutMs} ms.`));
		}, timeoutMs);

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});

		child.on("error", (error) => {
			if (settled) { return; }
			settled = true;
			clearTimeout(timer);
			reject(new Error(`Failed to run test command: ${error.message}`));
		});

		child.on("close", (exitCode) => {
			if (settled) { return; }
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

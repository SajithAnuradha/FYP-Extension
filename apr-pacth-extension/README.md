# APR Patch Extension

VS Code extension for sending the selected buggy code, nearby context, and natural-language feedback to the APR backend and applying the returned patch.

After applying a patch, the extension can run a user-specified test file through a user-specified test command. If the tests fail, the extension asks for another round of natural-language feedback and retries patch generation.

## Backend

Default backend:

`https://sajithanuradha890-fyp-fastapi-backend.hf.space`

Endpoint used by the extension:

`POST /generate-patch`

## Usage

1. Select the buggy line or code block in the active editor.
2. Run `Generate APR Patch` from the Command Palette.
3. Enter the test file path that should validate the patch.
4. Enter the test command to run. Use `{testFile}` as the placeholder for the resolved test file path.
5. Enter a short description of the issue and the expected fix.
6. The extension sends the request to the backend, applies the top returned patch candidate, and runs the requested tests.
7. If the tests fail, the extension prompts for refined natural-language feedback and retries until the tests pass or the maximum attempt limit is reached.

## Settings

This extension contributes the following settings:

- `apr.backendUrl`: Base URL for the APR backend service.
- `apr.requestTimeoutMs`: Timeout for patch-generation requests in milliseconds.
- `apr.defaultTestFilePath`: Default relative or absolute path to the test file to run after patching.
- `apr.testCommand`: Test command to execute after patching. Use `{testFile}` as a placeholder.
- `apr.maxPatchAttempts`: Maximum number of patch-generation attempts before the extension stops retrying.

# APR Patch Extension

VS Code extension for sending the selected buggy code, nearby context, and natural-language feedback to the APR backend and applying the returned patch.

## Backend

Default backend:

`https://sajithanuradha890-fyp-fastapi-backend.hf.space`

Endpoint used by the extension:

`POST /generate-patch`

## Usage

1. Select the buggy line or code block in the active editor.
2. Run `Generate APR Patch` from the Command Palette.
3. Enter a short description of the issue and the expected fix.
4. The extension sends the request to the backend and replaces the selection with the top returned patch candidate.

## Settings

This extension contributes the following settings:

- `apr.backendUrl`: Base URL for the APR backend service.
- `apr.requestTimeoutMs`: Timeout for patch-generation requests in milliseconds.

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

## Test command examples

The extension asks for a **test file path** (must exist on disk) and a **test command** that includes `{testFile}` as a placeholder. The placeholder is replaced with the resolved absolute path before the command is executed.

### JavaScript / TypeScript

| Build tool | Test file path | Test command |
|---|---|---|
| npm (Jest) | `src/__tests__/myBug.test.ts` | `npm test -- {testFile}` |
| npm (Mocha) | `test/myBug.spec.js` | `npm test -- {testFile}` |
| npx Jest | `src/__tests__/myBug.test.ts` | `npx jest {testFile}` |

### Python

| Build tool | Test file path | Test command |
|---|---|---|
| pytest | `tests/test_my_bug.py` | `pytest {testFile}` |
| unittest | `tests/test_my_bug.py` | `python -m unittest {testFile}` |

### Java

Java build tools take a class name rather than a file path. Use a shell substitution inside the command to strip the path and `.java` extension — this works because the command is run through a shell.

| Build tool | Test file path | Test command |
|---|---|---|
| Maven | `src/test/java/com/example/MyBugTest.java` | `mvn test -Dtest="$(basename {testFile} .java)"` |
| Gradle (macOS / Linux) | `src/test/java/com/example/MyBugTest.java` | `./gradlew test --tests "$(basename {testFile} .java)"` |
| Gradle (Windows) | `src\test\java\com\example\MyBugTest.java` | `gradlew.bat test --tests "$(basename {testFile} .java)"` |

**How the Java substitution works:**

`{testFile}` → `/abs/path/src/test/java/com/example/MyBugTest.java`
`$(basename {testFile} .java)` → `MyBugTest`
Final command → `mvn test -Dtest="MyBugTest"`

To run a specific test method, append `#methodName`:

```
mvn test -Dtest="$(basename {testFile} .java)#shouldReturnCorrectSum"
```

### Saving defaults

To avoid retyping the same values each run, set them in VS Code Settings (`Cmd+,`, search for `APR`):

- `apr.defaultTestFilePath` — pre-fills the test file prompt
- `apr.testCommand` — pre-fills the command prompt

Press **Enter** at either prompt to accept the saved default.

## Settings

This extension contributes the following settings:

- `apr.backendUrl`: Base URL for the APR backend service.
- `apr.requestTimeoutMs`: Timeout for patch-generation requests in milliseconds.
- `apr.defaultTestFilePath`: Default relative or absolute path to the test file to run after patching.
- `apr.testCommand`: Test command to execute after patching. Use `{testFile}` as a placeholder.
- `apr.maxPatchAttempts`: Maximum number of patch-generation attempts before the extension stops retrying.
- `apr.testTimeoutMs`: Timeout in milliseconds for the test command. The process is killed if the command exceeds this limit (default: 120000).

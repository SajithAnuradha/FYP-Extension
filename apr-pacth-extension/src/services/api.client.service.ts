import * as vscode from "vscode";
import {
	GeneratePatchRequest,
	GeneratePatchResponse,
} from "../types/patch.type";

const DEFAULT_BACKEND_URL =
	"https://sajithanuradha890-fyp-fastapi-backend.hf.space";

function buildGeneratePatchUrl(baseUrl: string): string {
	return `${baseUrl.replace(/\/+$/, "")}/generate-patch`;
}

export async function requestPatch(
	payload: GeneratePatchRequest,
): Promise<GeneratePatchResponse> {
	const config = vscode.workspace.getConfiguration("apr");
	const backendUrl = config.get<string>("backendUrl", DEFAULT_BACKEND_URL)?.trim();
	const requestTimeoutMs = config.get<number>("requestTimeoutMs", 30000);

	if (!backendUrl) {
		throw new Error("APR backend URL is not configured.");
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

	try {
		const response = await fetch(buildGeneratePatchUrl(backendUrl), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		if (!response.ok) {
			const body = await response.text();
			const details = body.trim() ? ` ${body}` : "";
			throw new Error(`Backend request failed: ${response.status}.${details}`);
		}

		return (await response.json()) as GeneratePatchResponse;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error(`Backend request timed out after ${requestTimeoutMs} ms.`);
		}

		if (error instanceof TypeError) {
			throw new Error(
				`Unable to reach APR backend at ${backendUrl}. Check the URL and your network connection.`,
			);
		}

		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

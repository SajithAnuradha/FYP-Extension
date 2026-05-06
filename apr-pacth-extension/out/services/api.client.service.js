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
exports.requestPatch = requestPatch;
const vscode = __importStar(require("vscode"));
const DEFAULT_BACKEND_URL = "https://sajithanuradha890-fyp-fastapi-backend.hf.space";
function buildGeneratePatchUrl(baseUrl) {
    return `${baseUrl.replace(/\/+$/, "")}/generate-patch`;
}
async function requestPatch(payload) {
    const config = vscode.workspace.getConfiguration("apr");
    const backendUrl = config.get("backendUrl", DEFAULT_BACKEND_URL)?.trim();
    const requestTimeoutMs = config.get("requestTimeoutMs", 30000);
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
        return (await response.json());
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Backend request timed out after ${requestTimeoutMs} ms.`);
        }
        if (error instanceof TypeError) {
            throw new Error(`Unable to reach APR backend at ${backendUrl}. Check the URL and your network connection.`);
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=api.client.service.js.map
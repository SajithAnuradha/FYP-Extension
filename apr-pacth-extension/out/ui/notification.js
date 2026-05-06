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
exports.showInfo = showInfo;
exports.showError = showError;
exports.showTestPass = showTestPass;
exports.showTestFailure = showTestFailure;
const vscode = __importStar(require("vscode"));
const aprOutputChannel = vscode.window.createOutputChannel("APR Patch Extension");
function showInfo(message) {
    void vscode.window.showInformationMessage(message);
}
function showError(message) {
    void vscode.window.showErrorMessage(message);
}
function showTestPass(message, output) {
    aprOutputChannel.clear();
    aprOutputChannel.appendLine("APR test run");
    aprOutputChannel.appendLine("");
    aprOutputChannel.appendLine(output || "Tests passed without additional output.");
    void vscode.window.showInformationMessage(message, "Show Test Output").then((action) => {
        if (action === "Show Test Output") {
            aprOutputChannel.show(true);
        }
    });
}
async function showTestFailure(message, output) {
    aprOutputChannel.clear();
    aprOutputChannel.appendLine("APR test failure");
    aprOutputChannel.appendLine("");
    aprOutputChannel.appendLine(output || "No test output was produced.");
    const action = await vscode.window.showErrorMessage(message, "Show Test Output");
    if (action === "Show Test Output") {
        aprOutputChannel.show(true);
    }
}
//# sourceMappingURL=notification.js.map
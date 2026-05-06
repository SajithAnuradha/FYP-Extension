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
exports.getNaturalLanguageFeedback = getNaturalLanguageFeedback;
const vscode = __importStar(require("vscode"));
function buildPrompt(options) {
    if (options?.testFailureOutput) {
        return `Tests failed after attempt ${options.attempt}. Describe how the next patch should change.`;
    }
    return "Describe what is wrong and what the patch should do";
}
function buildPlaceHolder(options) {
    if (options?.testFailureOutput) {
        return `Previous failure: ${options.testFailureOutput}`;
    }
    return "Example: Need to also handle empty dataset";
}
async function getNaturalLanguageFeedback(options) {
    return vscode.window.showInputBox({
        prompt: buildPrompt(options),
        placeHolder: buildPlaceHolder(options),
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.trim()) {
                return "Natural language feedback is required.";
            }
            return null;
        },
    });
}
//# sourceMappingURL=feedback-input.js.map
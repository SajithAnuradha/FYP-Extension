export interface SelectionPayload {
	startLine: number;
	endLine: number;
	selectedText: string;
}

export interface ContextPayload {
	before: string;
	after: string;
}

export interface GeneratePatchRequest {
	fileName: string;
	language: string;
	selection: SelectionPayload;
	context: ContextPayload;
	naturalLanguageFeedback?: string;
}

export interface PatchCandidate {
	patchedText: string;
	explanation: string;
	confidence: number;
}

export interface GeneratePatchResponse {
	patches: PatchCandidate[];
}
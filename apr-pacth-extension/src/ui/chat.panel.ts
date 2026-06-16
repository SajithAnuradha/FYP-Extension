import * as vscode from "vscode";

export type MessageRole = "user" | "assistant" | "code" | "patch" | "status" | "success" | "error";

export interface ChatMessage {
	role: MessageRole;
	content: string;
}

export class ChatPanel {
	private static instance: ChatPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private pendingResolve: ((value: string | null) => void) | null = null;

	private constructor(context: vscode.ExtensionContext) {
		this.panel = vscode.window.createWebviewPanel(
			"aprChat",
			"APR Patch Generator",
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			},
		);

		this.panel.webview.onDidReceiveMessage(
			(msg) => this.handleWebviewMessage(msg),
			undefined,
			context.subscriptions,
		);

		this.panel.onDidDispose(() => {
			ChatPanel.instance = undefined;
			if (this.pendingResolve) {
				this.pendingResolve(null);
				this.pendingResolve = null;
			}
		});

		this.panel.webview.html = buildHtml();
	}

	static createOrShow(context: vscode.ExtensionContext): ChatPanel {
		if (ChatPanel.instance) {
			ChatPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true);
			return ChatPanel.instance;
		}
		ChatPanel.instance = new ChatPanel(context);
		return ChatPanel.instance;
	}

	addMessage(role: MessageRole, content: string): void {
		this.panel.webview.postMessage({ type: "addMessage", role, content });
	}

	setStatus(text: string): void {
		this.panel.webview.postMessage({ type: "setStatus", text });
	}

	/**
	 * Show a prompt in the chat and wait for the user to type a reply.
	 * Returns the trimmed string (may be empty if user skipped an optional field),
	 * or null if the panel was closed.
	 */
	async waitForInput(prompt?: string): Promise<string | null> {
		if (prompt) {
			this.addMessage("assistant", prompt);
		}
		this.panel.webview.postMessage({ type: "enableInput" });
		return new Promise<string | null>((resolve) => {
			this.pendingResolve = resolve;
		});
	}

	private handleWebviewMessage(msg: { type: string; text?: string }): void {
		if (msg.type === "userMessage" && this.pendingResolve) {
			const resolve = this.pendingResolve;
			this.pendingResolve = null;
			this.addMessage("user", msg.text ?? "");
			this.panel.webview.postMessage({ type: "disableInput" });
			resolve(msg.text?.trim() ?? "");
		}
	}

	dispose(): void {
		this.panel.dispose();
	}
}

function buildHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>APR Patch Generator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:var(--vscode-font-family);
  font-size:var(--vscode-font-size);
  color:var(--vscode-foreground);
  background:var(--vscode-editor-background);
  display:flex;flex-direction:column;height:100vh;overflow:hidden
}
#header{
  padding:10px 14px;
  border-bottom:1px solid var(--vscode-panel-border);
  background:var(--vscode-sideBar-background);
  font-weight:600;font-size:13px;
  display:flex;align-items:center;gap:8px
}
#header-icon{font-size:16px}
#messages{
  flex:1;overflow-y:auto;padding:14px 14px;
  display:flex;flex-direction:column;gap:10px
}
.msg{display:flex;flex-direction:column;gap:3px;max-width:90%}
.msg.user{align-self:flex-end}
.msg.assistant,.msg.code,.msg.patch,.msg.status,.msg.success,.msg.error{align-self:flex-start}
.msg-label{
  font-size:11px;color:var(--vscode-descriptionForeground);padding:0 3px
}
.msg.user .msg-label{text-align:right}
.bubble{
  padding:8px 12px;border-radius:8px;
  line-height:1.5;white-space:pre-wrap;word-break:break-word
}
.user .bubble{
  background:var(--vscode-button-background);
  color:var(--vscode-button-foreground);
  border-radius:8px 8px 2px 8px
}
.assistant .bubble{
  background:var(--vscode-input-background);
  border:1px solid var(--vscode-input-border);
  border-radius:2px 8px 8px 8px
}
.code .bubble{
  background:var(--vscode-textCodeBlock-background);
  border:1px solid var(--vscode-panel-border);
  font-family:var(--vscode-editor-font-family,monospace);
  font-size:12px;overflow-x:auto;
  border-left:3px solid var(--vscode-textLink-foreground)
}
.patch .bubble{
  background:var(--vscode-textCodeBlock-background);
  border:1px solid var(--vscode-panel-border);
  font-family:var(--vscode-editor-font-family,monospace);
  font-size:12px;overflow-x:auto;
  border-left:3px solid #4ec9b0
}
.status .bubble{
  background:transparent;
  font-style:italic;font-size:12px;
  color:var(--vscode-descriptionForeground);
  padding:2px 4px;
  display:flex;align-items:center;gap:6px
}
.success .bubble{
  background:rgba(78,201,176,0.1);
  border:1px solid #4ec9b0;
  border-left:3px solid #4ec9b0
}
.error .bubble{
  background:rgba(244,135,113,0.1);
  border:1px solid var(--vscode-inputValidation-errorBorder);
  border-left:3px solid var(--vscode-inputValidation-errorBorder)
}
.spinner{
  width:10px;height:10px;
  border:2px solid transparent;
  border-top-color:var(--vscode-progressBar-background);
  border-radius:50%;
  animation:spin .7s linear infinite;
  display:inline-block;flex-shrink:0
}
@keyframes spin{to{transform:rotate(360deg)}}
#status-bar{
  padding:5px 14px;font-size:11px;min-height:22px;
  display:flex;align-items:center;gap:6px;
  background:var(--vscode-statusBar-background);
  color:var(--vscode-statusBar-foreground)
}
#input-area{
  display:flex;padding:10px 14px;gap:8px;
  border-top:1px solid var(--vscode-panel-border);
  background:var(--vscode-sideBar-background)
}
#user-input{
  flex:1;
  background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);
  border:1px solid var(--vscode-input-border);
  border-radius:4px;padding:8px 10px;
  font-family:inherit;font-size:inherit;
  resize:none;min-height:36px;max-height:120px;
  outline:none;line-height:1.4
}
#user-input:focus{border-color:var(--vscode-focusBorder)}
#user-input:disabled{opacity:.45;cursor:not-allowed}
#send-btn{
  background:var(--vscode-button-background);
  color:var(--vscode-button-foreground);
  border:none;border-radius:4px;
  padding:8px 14px;cursor:pointer;font-size:13px;
  align-self:flex-end;white-space:nowrap
}
#send-btn:hover:not(:disabled){background:var(--vscode-button-hoverBackground)}
#send-btn:disabled{opacity:.45;cursor:not-allowed}
#hint{
  padding:2px 14px 6px;font-size:11px;
  color:var(--vscode-descriptionForeground);min-height:18px
}
</style>
</head>
<body>
<div id="header">
  <span id="header-icon">&#128295;</span>
  APR Patch Generator
</div>
<div id="messages"></div>
<div id="status-bar"></div>
<div id="input-area">
  <textarea id="user-input" rows="1" placeholder="Type your message…" disabled></textarea>
  <button id="send-btn" disabled>Send</button>
</div>
<div id="hint"></div>
<script>
const vscode = acquireVsCodeApi();
const msgs = document.getElementById('messages');
const input = document.getElementById('user-input');
const btn = document.getElementById('send-btn');
const statusBar = document.getElementById('status-bar');
const hint = document.getElementById('hint');

const LABELS = {
  user:'You', assistant:'APR', code:'Selected Code',
  patch:'Generated Patch', status:'', success:'Result', error:'Error'
};

function addMessage(role, content){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  if(LABELS[role]){
    const lbl = document.createElement('div');
    lbl.className = 'msg-label';
    lbl.textContent = LABELS[role];
    wrap.appendChild(lbl);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if(role === 'status'){
    const sp = document.createElement('span');
    sp.className = 'spinner';
    bubble.appendChild(sp);
    bubble.appendChild(document.createTextNode(' ' + content));
  } else {
    bubble.textContent = content;
  }

  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function send(){
  const text = input.value;
  if(input.disabled) return;
  input.value = '';
  input.style.height = 'auto';
  hint.textContent = '';
  vscode.postMessage({type:'userMessage', text});
}

btn.addEventListener('click', send);
input.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

window.addEventListener('message', e => {
  const m = e.data;
  if(m.type === 'addMessage') addMessage(m.role, m.content);
  else if(m.type === 'enableInput'){
    input.disabled = false; btn.disabled = false;
    hint.textContent = 'Press Enter to send · Shift+Enter for new line';
    input.focus();
  }
  else if(m.type === 'disableInput'){
    input.disabled = true; btn.disabled = true;
    hint.textContent = '';
  }
  else if(m.type === 'setStatus'){
    statusBar.innerHTML = m.text
      ? '<span class="spinner"></span> ' + m.text
      : '';
  }
});
</script>
</body>
</html>`;
}

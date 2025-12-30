import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    // Register the Sidebar Provider
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "clearmetric.sidebar",
            sidebarProvider
        )
    );

    // Command: Reset Context (The "Trust" Feature)
    context.subscriptions.push(
        vscode.commands.registerCommand('clearmetric.resetContext', () => {
            sidebarProvider.postMessageToWebview({ type: 'RESET_CONTEXT' });
            vscode.window.showInformationMessage('ClearMetric: Context reset.');
        })
    );
}

export function deactivate() {}

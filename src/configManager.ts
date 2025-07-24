/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode"
import { OpenAIConfig } from "./types"

export class ConfigManager {
  private static readonly API_KEY_SECRET = "inflammation.openaiApiKey"
  private context: vscode.ExtensionContext

  constructor(context: vscode.ExtensionContext) {
    this.context = context
  }

  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ConfigManager.API_KEY_SECRET)
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(ConfigManager.API_KEY_SECRET, apiKey)
  }

  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(ConfigManager.API_KEY_SECRET)
  }

  getModel(): string {
    const config = vscode.workspace.getConfiguration("inflammation")
    return config.get<string>("openaiModel", "gpt-4o")
  }

  getWhisperModel(): string {
    const config = vscode.workspace.getConfiguration("inflammation")
    return config.get<string>("whisperModel", "whisper-1")
  }

  async getOpenAIConfig(): Promise<OpenAIConfig | null> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return null
    }

    return {
      apiKey,
      model: this.getModel(),
      whisperModel: this.getWhisperModel(),
    }
  }

  async promptForApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your OpenAI API key",
      placeHolder: "sk-...",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || !value.startsWith("sk-")) {
          return "Please enter a valid OpenAI API key"
        }
        return null
      },
    })

    if (apiKey) {
      await this.setApiKey(apiKey)
    }

    return apiKey
  }
}

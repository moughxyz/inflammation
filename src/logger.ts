import * as vscode from "vscode"

class Logger {
  private outputChannel: vscode.OutputChannel | null = null

  public initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel
  }

  public log(message: string): void {
    const timestamp = new Date().toISOString()
    const formattedMessage = `[${timestamp}] ${message}`

    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage)
    }

    // Also log to console for development
    console.log(formattedMessage)
  }

  public error(message: string, error?: Error): void {
    const timestamp = new Date().toISOString()
    let formattedMessage = `[${timestamp}] ❌ ERROR: ${message}`

    if (error) {
      formattedMessage += `\n${error.stack || error.message}`
    }

    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage)
    }

    // Also log to console for development
    console.error(formattedMessage)
  }

  public info(message: string): void {
    this.log(`ℹ️  ${message}`)
  }

  public warn(message: string): void {
    this.log(`⚠️  ${message}`)
  }

  public success(message: string): void {
    this.log(`✅ ${message}`)
  }

  public debug(message: string): void {
    this.log(`🐛 DEBUG: ${message}`)
  }

  public apiRequest(service: string, details: string): void {
    this.log(`📤 ${service} REQUEST: ${details}`)
  }

  public apiResponse(service: string, details: string): void {
    this.log(`📥 ${service} RESPONSE: ${details}`)
  }

  public separator(): void {
    this.log("==========================================")
  }
}

// Export a global instance
export const logger = new Logger()

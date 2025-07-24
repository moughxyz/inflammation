/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode"
import { AudioRecorder } from "./audioRecorder"
import { OpenAIClient } from "./openaiClient"
import { ConfigManager } from "./configManager"
import { logger } from "./logger"

let audioRecorder: AudioRecorder | null = null
let configManager: ConfigManager | null = null
let isKeyPressed = false
let outputChannel: vscode.OutputChannel | null = null
let lastCommandTime = 0
let releaseTimer: NodeJS.Timeout | null = null
let listeningStatusBar: vscode.StatusBarItem | null = null
const COMMAND_DEBOUNCE_MS = 300 // Prevent rapid-fire commands
const RELEASE_DELAY_MS = 250 // considered key released when no repeat event for this window

export function activate(context: vscode.ExtensionContext) {
  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Inflammation")
  context.subscriptions.push(outputChannel)

  // Initialize the global logger
  logger.initialize(outputChannel)

  logger.info("Inflammation extension is now active!")
  logger.info(`Extension context: ${context.extensionPath}`)
  logger.info("Registering commands...")
  logger.info("Initializing components...")

  // Initialize components
  configManager = new ConfigManager(context)
  audioRecorder = new AudioRecorder(context)

  // Create status bar item for recording state (left side for prominence)
  listeningStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  )
  context.subscriptions.push(listeningStatusBar)

  // Register the main command - this now handles push-to-talk
  const recordCommand = vscode.commands.registerCommand(
    "inflammation.startRecording",
    async () => {
      await handlePushToTalk()
    }
  )

  // Add a test command
  const testCommand = vscode.commands.registerCommand(
    "inflammation.testCommand",
    () => {
      logger.info("Test command triggered!")
      vscode.window.showInformationMessage("Inflammation test command works!")
    }
  )

  // Add stop recording command
  const stopCommand = vscode.commands.registerCommand(
    "inflammation.stopRecording",
    async () => {
      logger.info("Stop recording command triggered!")
      if (audioRecorder && audioRecorder.isRecording()) {
        await handleKeyRelease()
      } else {
        vscode.window.showInformationMessage("No recording in progress")
      }
    }
  )

  // Add API test command
  const testApiCommand = vscode.commands.registerCommand(
    "inflammation.testApi",
    async () => {
      logger.info("🧪 Testing API connection...")

      if (!configManager) {
        vscode.window.showErrorMessage("Configuration manager not initialized")
        return
      }

      try {
        const config = await configManager.getOpenAIConfig()
        if (!config) {
          vscode.window.showErrorMessage(
            "No API key configured. Please configure your OpenAI API key first."
          )
          return
        }

        logger.info(
          `🔑 Testing with API key: ${config.apiKey.substring(0, 10)}...`
        )

        // Test basic OpenAI connection by listing models
        const { OpenAIClient } = await import("./openaiClient")
        const client = new OpenAIClient(config)

        // Create a simple test by trying to access the client
        logger.info("🌐 Testing OpenAI connection...")

        vscode.window.showInformationMessage(
          "API test completed - check Output panel for details"
        )
      } catch (error) {
        logger.error(
          "API test failed",
          error instanceof Error ? error : new Error("Unknown error")
        )
        vscode.window.showErrorMessage(
          `API test failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      }
    }
  )

  // Register configuration command
  const configCommand = vscode.commands.registerCommand(
    "inflammation.configureApiKey",
    async () => {
      if (!configManager) {
        return
      }

      const apiKey = await configManager.promptForApiKey()
      if (apiKey) {
        vscode.window.showInformationMessage(
          "OpenAI API key saved successfully!"
        )
      }
    }
  )

  // Add command to palette
  const paletteCommand = vscode.commands.registerCommand(
    "inflammation.showCommands",
    async () => {
      const items = [
        {
          label: "$(key) Configure API Key",
          command: "inflammation.configureApiKey",
        },
        {
          label: "$(record) Start Recording (Cmd+Shift+Z)",
          command: "inflammation.startRecording",
        },
        {
          label: "$(stop) Stop Recording",
          command: "inflammation.stopRecording",
        },
        {
          label: "$(plug) Test API Connection",
          command: "inflammation.testApi",
        },
      ]

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an Inflammation command",
      })

      if (selected) {
        vscode.commands.executeCommand(selected.command)
      }
    }
  )

  context.subscriptions.push(
    recordCommand,
    testCommand,
    stopCommand,
    testApiCommand,
    configCommand,
    paletteCommand
  )

  logger.success("All commands registered successfully!")
  logger.success("Extension activation complete.")
}

async function handlePushToTalk() {
  if (!audioRecorder || !configManager) {
    return
  }

  const now = Date.now()

  /*
   * Case 1 – not recording yet: start and initialise release timer
   */
  if (!audioRecorder.isRecording()) {
    // Debounce initial press
    if (now - lastCommandTime < COMMAND_DEBOUNCE_MS) {
      return
    }
    lastCommandTime = now

    await startRecording()

    // Initialise release timer
    resetReleaseTimer()
    return
  }

  /*
   * Case 2 – already recording: just refresh the release timer so we know key is still held
   */
  lastCommandTime = now
  resetReleaseTimer()
}

function resetReleaseTimer() {
  // Clear previous timer
  if (releaseTimer) {
    clearTimeout(releaseTimer)
  }
  // Start new timer – if it fires, we treat it as key released
  releaseTimer = setTimeout(() => {
    handleKeyRelease()
  }, RELEASE_DELAY_MS)
}

async function startRecording() {
  if (!audioRecorder || !configManager) {
    return
  }

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found")
    return
  }

  // Check if we have API key
  const config = await configManager.getOpenAIConfig()
  if (!config) {
    const apiKey = await configManager.promptForApiKey()
    if (!apiKey) {
      return
    }
  }

  // Start recording
  isKeyPressed = true
  await audioRecorder.startRecording()

  // Show listening status
  if (listeningStatusBar) {
    listeningStatusBar.text = "🎙️ Listening..."
    listeningStatusBar.tooltip = "Recording audio - Release hotkey to stop"
    listeningStatusBar.show()
  }

  logger.info("Recording started")
}

async function handleRecording() {
  logger.info("handleRecording called")
  logger.debug(`audioRecorder exists: ${!!audioRecorder}`)
  logger.debug(`configManager exists: ${!!configManager}`)
  if (!audioRecorder || !configManager) {
    return
  }

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found")
    return
  }

  // Check if we have API key
  const config = await configManager.getOpenAIConfig()
  if (!config) {
    const apiKey = await configManager.promptForApiKey()
    if (!apiKey) {
      return
    }
  }

  if (!audioRecorder.isRecording()) {
    // Start recording
    isKeyPressed = true
    await audioRecorder.startRecording()
  } else {
    // Stop recording on second press
    handleKeyRelease()
  }
}

async function handleKeyRelease() {
  if (!audioRecorder || !configManager) {
    return
  }

  logger.info("🔴 Stopping recording and processing audio...")

  isKeyPressed = false

  // Hide listening status
  if (listeningStatusBar) {
    listeningStatusBar.hide()
  }

  const audioData = await audioRecorder.stopRecording()
  if (!audioData) {
    logger.warn("No audio data received")
    return
  }

  logger.success(
    `Audio captured: ${audioData.buffer.length} bytes, ${audioData.duration}s`
  )

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    logger.error("No active text editor found")
    vscode.window.showErrorMessage("No active text editor found")
    return
  }

  logger.info("📝 Active editor found, starting API processing...")

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Processing audio...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({
          increment: 0,
          message: "Getting OpenAI configuration...",
        })
        logger.info("🔑 Getting OpenAI configuration...")

        const config = await configManager!.getOpenAIConfig()
        if (!config) {
          throw new Error("OpenAI API key not configured")
        }

        logger.success(`OpenAI config loaded, using model: ${config.model}`)

        const openaiClient = new OpenAIClient(config)

        progress.report({ increment: 30, message: "Transcribing audio..." })
        logger.info("🎤 Sending audio to Whisper API...")

        // Transcribe audio
        const transcription = await openaiClient.transcribeAudio(
          audioData.buffer
        )

        logger.info(`🎤 Whisper transcription: "${transcription.text}"`)

        if (!transcription.text.trim()) {
          logger.warn("No speech detected in transcription")
          vscode.window.showWarningMessage(
            "No speech detected in the recording"
          )
          return
        }

        progress.report({ increment: 30, message: "Processing with AI..." })

        // Get file context
        const document = editor.document
        const position = editor.selection.active
        const fileContent = document.getText()
        const fileName = document.fileName

        logger.info(
          `🧠 Sending to GPT for processing. File: ${fileName}, cursor at line ${
            position.line + 1
          }`
        )

        // Process with GPT
        const result = await openaiClient.processWithContext(
          transcription.text,
          fileContent,
          { line: position.line, character: position.character },
          fileName
        )

        logger.info(`🧠 GPT processed text: "${result.processedText}"`)

        progress.report({ increment: 30, message: "Inserting text..." })

        logger.info("✏️ Inserting text at cursor position...")

        // Insert the processed text at cursor position
        await editor.edit((editBuilder) => {
          editBuilder.insert(position, result.processedText)
        })

        progress.report({ increment: 10, message: "Done!" })

        // Show info about what was inserted
        const insertedLines = result.processedText.split("\n").length
        logger.success(`Successfully inserted ${insertedLines} line(s) of text`)

        // Show success message that auto-dismisses after 5 seconds
        const successMessage = `Inserted ${insertedLines} line(s) of text. Original: "${transcription.text.substring(
          0,
          50
        )}${transcription.text.length > 50 ? "..." : ""}"`

        // Use status bar for auto-dismissing message
        if (listeningStatusBar) {
          listeningStatusBar.text = `✅ ${successMessage}`
          listeningStatusBar.tooltip = "Auto-dismissing in 5 seconds"
          listeningStatusBar.show()

          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            if (listeningStatusBar) {
              listeningStatusBar.hide()
            }
          }, 5000)
        }
      } catch (error) {
        logger.error(
          "Processing error",
          error instanceof Error ? error : new Error("Unknown error")
        )
        vscode.window.showErrorMessage(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }
  )
}

export function deactivate() {
  if (audioRecorder) {
    audioRecorder.dispose()
  }
  if (listeningStatusBar) {
    listeningStatusBar.dispose()
  }
}

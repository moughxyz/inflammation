import * as vscode from "vscode"
import { spawn, ChildProcess } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { AudioData, RecordingState } from "./types"

export class AudioRecorder {
  private recordingProcess: ChildProcess | null = null
  private recordingState: RecordingState = { isRecording: false }
  private outputPath: string
  private statusBarItem: vscode.StatusBarItem

  constructor(private context: vscode.ExtensionContext) {
    this.outputPath = path.join(os.tmpdir(), "inflammation_recording.wav")
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    )
    this.context.subscriptions.push(this.statusBarItem)
  }

  async startRecording(): Promise<void> {
    if (this.recordingState.isRecording) {
      console.log("⚠️ Recording already in progress, ignoring start request")
      return
    }

    console.log("🎙️ Starting audio recording...")
    this.recordingState = { isRecording: true, startTime: Date.now() }
    // Status bar is now handled by the main extension

    try {
      // Remove old recording if exists
      if (fs.existsSync(this.outputPath)) {
        fs.unlinkSync(this.outputPath)
        console.log("🗑️ Removed old recording file")
      }

      // Use sox or ffmpeg for cross-platform audio recording
      const recordCommand = this.getRecordCommand()
      console.log(
        `🔧 Starting recording with command: ${
          recordCommand.command
        } ${recordCommand.args.join(" ")}`
      )

      this.recordingProcess = spawn(recordCommand.command, recordCommand.args)

      this.recordingProcess.on("error", (error) => {
        console.error("❌ Recording process error:", error)
        vscode.window.showErrorMessage(
          `Failed to start recording: ${error.message}`
        )
        this.stopRecording()
      })

      this.recordingProcess.stderr?.on("data", (data) => {
        console.log("📊 Recording stderr:", data.toString())
      })

      console.log("✅ Recording process started successfully")
    } catch (error) {
      console.error("❌ Failed to start recording:", error)
      vscode.window.showErrorMessage(
        `Failed to start recording: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
      this.recordingState.isRecording = false
      // Status bar is now handled by the main extension
    }
  }

  async stopRecording(): Promise<AudioData | null> {
    if (!this.recordingState.isRecording || !this.recordingProcess) {
      console.log("⚠️ No recording in progress to stop")
      return null
    }

    console.log("🛑 Stopping audio recording...")
    const duration = Date.now() - (this.recordingState.startTime || Date.now())
    this.recordingState.isRecording = false
    // Status bar is now handled by the main extension

    return new Promise((resolve) => {
      if (!this.recordingProcess) {
        console.log("❌ No recording process found")
        resolve(null)
        return
      }

      this.recordingProcess.on("close", () => {
        try {
          console.log(`📁 Checking for audio file at: ${this.outputPath}`)
          if (fs.existsSync(this.outputPath)) {
            const buffer = fs.readFileSync(this.outputPath)
            console.log(
              `✅ Audio file read successfully: ${buffer.length} bytes`
            )
            fs.unlinkSync(this.outputPath) // Clean up
            console.log("🗑️ Cleaned up temp audio file")

            resolve({
              buffer,
              sampleRate: 16000,
              duration: duration / 1000,
            })
          } else {
            console.log("❌ Audio file not found after recording")
            resolve(null)
          }
        } catch (error) {
          console.error("❌ Error reading audio file:", error)
          resolve(null)
        }
      })

      // Send interrupt signal to stop recording
      console.log("📡 Sending stop signal to recording process...")
      if (os.platform() === "win32") {
        spawn("taskkill", [
          "/pid",
          this.recordingProcess.pid!.toString(),
          "/f",
          "/t",
        ])
      } else {
        this.recordingProcess.kill("SIGINT")
      }

      this.recordingProcess = null
    })
  }

  private getRecordCommand(): { command: string; args: string[] } {
    const platform = os.platform()

    if (platform === "darwin") {
      // macOS - use sox or ffmpeg
      return {
        command: "sox",
        args: [
          "-d", // default audio device
          "-r",
          "16000", // sample rate
          "-c",
          "1", // mono
          "-b",
          "16", // 16-bit
          this.outputPath, // output file
        ],
      }
    } else if (platform === "win32") {
      // Windows - use sox
      return {
        command: "sox",
        args: ["-d", "-r", "16000", "-c", "1", "-b", "16", this.outputPath],
      }
    } else {
      // Linux - use arecord
      return {
        command: "arecord",
        args: [
          "-f",
          "S16_LE", // format
          "-r",
          "16000", // sample rate
          "-c",
          "1", // channels
          this.outputPath, // output file
        ],
      }
    }
  }

  private updateStatusBar(text: string, tooltip: string): void {
    this.statusBarItem.text = text
    this.statusBarItem.tooltip = tooltip
    this.statusBarItem.show()
  }

  private hideStatusBar(): void {
    this.statusBarItem.hide()
  }

  isRecording(): boolean {
    return this.recordingState.isRecording
  }

  dispose(): void {
    if (this.recordingProcess) {
      this.recordingProcess.kill()
    }
    this.statusBarItem.dispose()
  }
}

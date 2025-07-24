/* eslint-disable @typescript-eslint/naming-convention */
import * as https from "https"
import * as fs from "fs"
import * as path from "path"
import FormData from "form-data"
import { OpenAIConfig, TranscriptionResult, ProcessingResult } from "./types"
import { logger } from "./logger"

export class OpenAIClient {
  private config: OpenAIConfig

  constructor(config: OpenAIConfig) {
    this.config = config
  }

  private makeRequest(
    options: https.RequestOptions,
    postData?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          try {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(JSON.parse(data))
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`))
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        })
      })

      req.on("error", (error) => {
        reject(error)
      })

      if (postData) {
        req.write(postData)
      }
      req.end()
    })
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string = "audio.wav"
  ): Promise<TranscriptionResult> {
    try {
      logger.info(
        `📁 Creating temp file for audio: ${filename} (${audioBuffer.length} bytes)`
      )
      logger.info(
        `🔑 API Key configured: ${this.config.apiKey.substring(0, 10)}...`
      )

      // Create a temporary file for the audio
      const tempDir = path.join(__dirname, "temp")
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const tempPath = path.join(tempDir, filename)
      fs.writeFileSync(tempPath, audioBuffer)
      logger.info(`📁 Temp file created at: ${tempPath}`)
      logger.info(`📊 File stats: ${fs.statSync(tempPath).size} bytes`)

      logger.info(
        `🌐 Calling Whisper API with model: ${this.config.whisperModel}`
      )

      // Log the request details being sent to Whisper API
      logger.apiRequest(
        "WHISPER API",
        `Model: ${this.config.whisperModel}, File: ${filename} (${audioBuffer.length} bytes)`
      )
      logger.separator()

      // Create FormData for the API request
      const formData = new FormData()
      formData.append("file", fs.createReadStream(tempPath))
      formData.append("model", this.config.whisperModel)

      const requestOptions: https.RequestOptions = {
        hostname: "api.openai.com",
        port: 443,
        path: "/v1/audio/transcriptions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...formData.getHeaders(),
        },
      }

      logger.info(`🚀 Making direct HTTPS request to OpenAI...`)

      // Create timeout wrapper
      const transcriptionPromise = new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let data = ""
          res.on("data", (chunk) => (data += chunk))
          res.on("end", () => {
            try {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                const response = JSON.parse(data)
                resolve(response)
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`))
              }
            } catch (error) {
              reject(new Error(`Failed to parse response: ${data}`))
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        formData.pipe(req)
      })

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(new Error("Whisper API request timed out after 60 seconds")),
          60000
        )
      })

      const transcription = (await Promise.race([
        transcriptionPromise,
        timeoutPromise,
      ])) as any

      // Log the full response received from Whisper API
      logger.apiResponse(
        "WHISPER API",
        `Complete Response: ${JSON.stringify(transcription, null, 2)}`
      )
      logger.separator()

      logger.success(`Whisper API response received: "${transcription.text}"`)

      // Clean up temp file
      fs.unlinkSync(tempPath)

      return {
        text: transcription.text,
      }
    } catch (error) {
      logger.error(
        `Whisper API error details`,
        error instanceof Error ? error : new Error("Unknown error")
      )

      if (error instanceof Error) {
        if (
          error.message.includes("401") ||
          error.message.includes("Unauthorized")
        ) {
          throw new Error(
            `Invalid API key. Please check your OpenAI API key in settings.`
          )
        } else if (
          error.message.includes("403") ||
          error.message.includes("Forbidden")
        ) {
          throw new Error(
            `API access forbidden. Your API key may not have access to Whisper API.`
          )
        } else if (error.message.includes("timeout")) {
          throw new Error(
            `Request timeout. Please check your internet connection and try again.`
          )
        } else if (
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ECONNREFUSED")
        ) {
          throw new Error(
            `Cannot connect to OpenAI servers. Please check your internet connection.`
          )
        } else if (
          error.message.includes("413") ||
          error.message.includes("too large")
        ) {
          throw new Error(
            `Audio file too large. Please record shorter audio (max 25MB).`
          )
        }
      }

      throw new Error(
        `Transcription failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }

  async processWithContext(
    transcribedText: string,
    fileContent: string,
    cursorPosition: { line: number; character: number },
    fileName: string
  ): Promise<ProcessingResult> {
    try {
      logger.info(
        `🧠 Building prompt for GPT. File: ${fileName}, transcription: "${transcribedText}"`
      )

      const prompt = this.buildPrompt(
        transcribedText,
        fileContent,
        cursorPosition,
        fileName
      )

      const messages = [
        {
          role: "system",
          content:
            "You are a helpful coding assistant. The user has dictated some text that should be inserted or used to modify their code. Consider the context of the file and cursor position to provide the most appropriate code or text to insert at that location. Return ONLY the text to be inserted, without any explanation or markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ]

      logger.info(`🌐 Calling GPT API with model: ${this.config.model}`)
      logger.info(`📝 Prompt length: ${prompt.length} characters`)

      // Log the full prompt being sent to the API
      logger.apiRequest("GPT API", `System Message: ${messages[0].content}`)
      logger.apiRequest("GPT API", `User Message: ${messages[1].content}`)
      logger.separator()

      const requestBody = JSON.stringify({
        model: this.config.model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4096,
      })

      const requestOptions: https.RequestOptions = {
        hostname: "api.openai.com",
        port: 443,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      }

      logger.info(`🚀 Making direct HTTPS request to GPT API...`)

      const completion = (await new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let data = ""
          res.on("data", (chunk) => (data += chunk))
          res.on("end", () => {
            try {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                const response = JSON.parse(data)
                resolve(response)
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`))
              }
            } catch (error) {
              reject(new Error(`Failed to parse response: ${data}`))
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        req.write(requestBody)
        req.end()
      })) as any

      // Log the full response received from the API
      logger.apiResponse(
        "GPT API",
        `Complete Response: ${JSON.stringify(completion, null, 2)}`
      )
      logger.separator()

      const processedText =
        completion.choices[0]?.message?.content || transcribedText

      logger.success(`GPT API response received: "${processedText}"`)
      logger.info(
        `📊 Usage: ${completion.usage?.prompt_tokens} prompt + ${completion.usage?.completion_tokens} completion = ${completion.usage?.total_tokens} total tokens`
      )

      return {
        originalTranscription: transcribedText,
        processedText: processedText.trim(),
        model: this.config.model,
      }
    } catch (error) {
      logger.error(
        `GPT API error`,
        error instanceof Error ? error : new Error("Unknown error")
      )
      throw new Error(
        `Processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }

  private buildPrompt(
    transcribedText: string,
    fileContent: string,
    cursorPosition: { line: number; character: number },
    fileName: string
  ): string {
    // Split file content into lines
    const lines = fileContent.split("\n")
    const currentLine = lines[cursorPosition.line] || ""
    const beforeCursor = currentLine.substring(0, cursorPosition.character)
    const afterCursor = currentLine.substring(cursorPosition.character)

    // Get context around cursor (5 lines before and after)
    const contextStart = Math.max(0, cursorPosition.line - 5)
    const contextEnd = Math.min(lines.length, cursorPosition.line + 6)
    const contextLines = lines.slice(contextStart, contextEnd)

    return `File: ${fileName}
Current cursor position: Line ${cursorPosition.line + 1}, Column ${
      cursorPosition.character + 1
    }

Context around cursor:
${contextLines
  .map((line, idx) => {
    const lineNum = contextStart + idx
    const prefix = lineNum === cursorPosition.line ? "> " : "  "
    return `${prefix}${lineNum + 1}: ${line}`
  })
  .join("\n")}

Text before cursor on current line: "${beforeCursor}"
Text after cursor on current line: "${afterCursor}"

User's dictated text: "${transcribedText}"

Your requirements (read very carefully):

1. Based on the context and the user's dictation, provide the **exact text that should be inserted at the cursor position**. Consider whether this is a new line, completing existing code, or replacing text.

2. **Never complete more than what the user specifically asked for.**
   Don't think forward or ahead. Just transcribe what the user orated into its code counterpart.

3. **Reply only with the literal text to insert.**
   Anything in your response will directly be inserted into the editor, so provide no commentary or triple backticks.

4. **Pay attention to the file name extension**
   For example, if the file type is .go, never insert anything that isn't Go code. Same goes for .js, .ts, and so on.
   `
  }
}

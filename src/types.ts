export interface RecordingState {
  isRecording: boolean
  startTime?: number
}

export interface OpenAIConfig {
  apiKey: string
  model: string
  whisperModel: string
}

export interface AudioData {
  buffer: Buffer
  sampleRate: number
  duration: number
}

export interface TranscriptionResult {
  text: string
  duration?: number
}

export interface ProcessingResult {
  originalTranscription: string
  processedText: string
  model: string
}

# Development Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Audio Recording Tool**
   ```bash
   # macOS
   brew install sox

   # Ubuntu/Debian
   sudo apt-get install sox

   # Windows
   # Download from http://sox.sourceforge.net/
   ```

3. **Compile TypeScript**
   ```bash
   npm run compile
   ```

4. **Run Extension in Debug Mode**
   - Open this project in VSCode
   - Press `F5` to launch a new VSCode window with the extension loaded
   - Open any text file in the new window
   - Press `Cmd+Alt+Z` to test recording

## Testing the Extension

### Manual Testing Checklist

1. **First Run**
   - [ ] Extension activates without errors
   - [ ] Pressing Cmd+Alt+Z prompts for API key if not set
   - [ ] API key is saved securely

2. **Recording**
   - [ ] Cmd+Alt+Z starts recording
   - [ ] Status bar shows "Recording..."
   - [ ] Cmd+Alt+Z again stops recording
   - [ ] Audio is transcribed correctly
   - [ ] Text is inserted at cursor position

3. **Error Handling**
   - [ ] Invalid API key shows error message
   - [ ] No microphone shows appropriate error
   - [ ] Network errors are handled gracefully

### Test Commands

Test the audio recording command directly:
```bash
# Test if sox is installed and working
sox -d test.wav trim 0 3

# Play back the recording
play test.wav
```

## Building for Production

1. **Install VSCE**
   ```bash
   npm install -g vsce
   ```

2. **Package Extension**
   ```bash
   vsce package
   ```

3. **Install in VSCode/Cursor**
   - Open Command Palette
   - Run "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

## Architecture Notes

### Audio Recording Flow
1. User presses Cmd+B → `inflammation.startRecording` command triggered
2. `AudioRecorder` spawns sox process to record audio
3. Audio saved to temp file in WAV format
4. On second Cmd+B press, recording stops
5. Audio file read and sent to OpenAI

### OpenAI Integration
1. Audio transcribed using Whisper API
2. Transcription + file context sent to GPT-4
3. GPT-4 returns code/text to insert
4. Text inserted at cursor position

### Security
- API keys stored in VSCode SecretStorage
- Temporary audio files deleted after processing
- No data persisted locally

## Common Issues

### "spawn sox ENOENT"
Sox is not installed or not in PATH. Install sox and ensure it's accessible from terminal.

### Recording doesn't stop
The sox process might be hanging. Kill it manually:
```bash
pkill sox
```

### API Rate Limits
OpenAI has rate limits. If you hit them, wait a moment before trying again.

## Debugging Tips

1. **Check Extension Output**
   - View → Output → Select "Inflammation" from dropdown

2. **Enable Verbose Logging**
   - Add console.log statements in key functions
   - Check Developer Tools console (Help → Toggle Developer Tools)

3. **Test OpenAI Connection**
   ```typescript
   // Add this to test your API key
   const client = new OpenAI({ apiKey: 'your-key' });
   const test = await client.models.list();
   console.log(test);
   ```
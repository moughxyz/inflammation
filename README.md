<div align="center">

<img src="icon.png" width="50%" alt="Inflammation Icon">

# Inflammation - Line Aware Voice-to-Code Extension

</div>

Inflammation lets you dictate code inside VSCode/Cursor. It's context aware and let's you convert speech like

> export function foo take in string bar and string car return string

into

```ts
export function foo(bar: string, car: string): string {}
```

You can see a demo video [here](https://x.com/moughxyz/status/1948477448838152259).

It's named inflammation because it's gotten hard for me to type on some days due to inflammation and I needed something
I can dictate to on a line-per-line basis.

## Contribute

This extension is simple enough for my needs. Please help improve it by submitting a PR.

## Usage

After installing, hit cmd + shift + z to start listening. Release when you're done talking.

And that's it.

You can change the hotkey by going into your keyboard shortcut prefs: **Preferences :Open Keyboard Shortcuts.** from the command pallete.

## Installation

### From VSCode Marketplace:

https://marketplace.visualstudio.com/items?itemName=moughxyz.inflammation

### From vsix file:

You can find the .vsix files in the vsix dir on GitHub:

## Prerequisites

### 1. Audio Recording Software

The extension requires audio recording software to be installed on your system:

- **macOS**: Install SoX

  ```bash
  brew install sox
  ```

- **Windows**: Install SoX

  - Download from: http://sox.sourceforge.net/
  - Add to your system PATH

- **Linux**: Install arecord (usually pre-installed)
  ```bash
  sudo apt-get install alsa-utils
  ```

### 2. OpenAI API Key

You'll need an OpenAI API key with access to:

- Whisper API (for transcription)
- GPT-4 or GPT-3.5 (for text processing)

Get your API key from: https://platform.openai.com/api-keys

## Installation

### From VSCode Marketplace:

https://marketplace.visualstudio.com/items?itemName=moughxyz.inflammation

### From Source (Development)

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Open in VSCode and press `F5` to run the extension in a new window

### Building the Extension

To create a `.vsix` package:

1. Install vsce globally:
   ```bash
   npm install -g vsce
   ```
2. Package the extension:
   ```bash
   vsce package
   ```
3. Install the generated `.vsix` file in VSCode/Cursor

## Usage

### First Time Setup

1. Open any text file in VSCode/Cursor
2. Press `Cmd+Alt+Z` (the extension will prompt for your OpenAI API key)
3. Enter your API key (it will be stored securely)

### Recording Audio

1. Place your cursor where you want to insert text
2. Press `Cmd+Alt+Z` to start recording (you'll see "Recording..." in the status bar)
3. Speak your code or text
4. Press `Cmd+Alt+Z` again to stop recording and process

The extension will:

1. Transcribe your audio using Whisper
2. Process the transcription with GPT-4 using your file's context
3. Insert the result at your cursor position

### Configuration

You can configure the extension in VSCode settings:

- `inflammation.openaiModel`: Choose the GPT model (default: `gpt-4-turbo-preview`)
- `inflammation.whisperModel`: Choose the Whisper model (default: `whisper-1`)

To change your API key:

1. Open Command Palette (`Cmd+Shift+P`)
2. Run "Inflammation: Configure API Key"

## Troubleshooting

### "Failed to start recording"

- Ensure you have the required audio recording software installed
- Check microphone permissions in your system settings
- Try running the audio recording command manually to test

### "No speech detected"

- Check your microphone is working
- Speak louder or closer to the microphone
- Ensure no other application is using the microphone

### API Errors

- Verify your API key is valid
- Check your OpenAI account has sufficient credits
- Ensure you have access to the selected models

### Running Tests

```bash
npm test
```

### Contributing

Pull requests are welcome! Please ensure your code follows the existing style and includes appropriate tests.

## License

MIT

## Support

For issues and feature requests, please use the GitHub issue tracker.

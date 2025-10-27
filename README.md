# RealtimeTransformer

A customizable AI chatbot with real-time voice conversations, image generation, and analysis capabilities. Built for educational and research purposes.

## Features

- **Real-time Voice Conversations**: Interactive voice chat using OpenAI's Realtime API
- **Customizable AI Personality**: Configure the AI's behavior through custom system prompts
- **Multi-language Support**: Choose from 15+ languages for conversations
- **Voice Selection**: Multiple AI voices available (Alloy, Echo, Fable, Nova, Onyx, Shimmer)
- **Image Generation**: Create images using DALL-E 3
- **Image Analysis**: Analyze uploaded images using GPT-4 Vision
- **Push-to-Talk**: Control when the AI listens (spacebar or button)
- **Auto-scrolling Chat**: Seamless conversation flow with automatic scrolling
- **Event Logging**: Debug and monitor application events

## Prerequisites

- Node.js 18+ 
- OpenAI API key
- Modern web browser with microphone access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd realtime-transformer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Basic Voice Chat
1. Click "Start Voice Chat" to connect
2. The AI will introduce itself automatically
3. Speak naturally or use Push-to-Talk mode
4. Use spacebar or the Talk button when Push-to-Talk is enabled

### Customizing the AI
1. Open the configuration panel
2. Select your preferred language
3. Enter a custom system prompt to define the AI's personality
4. Choose your preferred voice
5. Start chatting with your customized AI

### Image Features
- **Generate Images**: Ask the AI to create images using DALL-E 3
- **Analyze Images**: Upload images for analysis using GPT-4 Vision

### Controls
- **Connect/Disconnect**: Start or end voice sessions
- **Interrupt**: Stop the AI mid-response
- **Continue**: Resume after interruption
- **Push-to-Talk**: Toggle continuous listening
- **Audio Playback**: Enable/disable AI voice output
- **Logs**: View application events and debugging information

## Configuration

### System Prompts
Customize the AI's behavior by providing system prompts. Examples:
- Educational tutor: "You are a patient, knowledgeable tutor who explains concepts clearly"
- Creative writer: "You are a creative writing assistant who helps with storytelling"
- Technical expert: "You are a software engineering expert who provides detailed technical guidance"

### Voice Options
- **Alloy**: Balanced, clear voice
- **Echo**: Warm, conversational tone
- **Fable**: Expressive, storytelling voice
- **Nova**: Energetic, enthusiastic voice
- **Onyx**: Deep, authoritative voice
- **Shimmer**: Light, friendly voice

## Technical Details

- **Framework**: Next.js 15.5.2 with TypeScript
- **AI Integration**: OpenAI Realtime API, GPT-4 Vision, DALL-E 3
- **Audio**: WebRTC with Opus/PCMU/PCMA codecs
- **Styling**: Tailwind CSS
- **State Management**: React Context API

## Troubleshooting

### Connection Issues
- Ensure your OpenAI API key is valid and has sufficient credits
- Check browser microphone permissions
- Try refreshing the page and reconnecting

### Voice Problems
- Some voices may not be available in all regions
- If voice selection fails, the app will fallback to 'alloy'
- Check browser console for WebRTC errors

### Audio Issues
- Ensure microphone is not muted
- Check browser audio permissions
- Try different codec options in settings

## Development

### Project Structure
```
src/
├── app/
│   ├── agentConfigs/     # AI agent configurations
│   ├── api/              # API routes
│   ├── components/       # React components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utility functions
```

### Available Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## Disclaimer

⚠️ **Disclaimer**: This application is created for research and educational purposes. It is experimental and uses large language models (LLMs) that may confabulate or hallucinate. Please verify important information independently and use at your own discretion.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Created and developed by [Marlon Barrios Solano](https://marlonbarrios.github.io/)

For educational and research purposes. Contributions and feedback are welcome!
# Perceptia

**Perceptia** is an Electron-based application that allows users to capture a region of their screen and get AI-generated responses such as summaries, translations, explanations, and answers based on the captured content. The application leverages the Groq AI model to process the screenshots and provide meaningful responses.

## Features
- Capture Screen Region: Select a region of the screen to capture.
- AI-Powered Responses: Get summaries, translations, explanations, and answers based on the captured content.
- Custom Prompts: Input custom prompts for the AI to process the captured region.
- Language Selection: Choose the language for translations.
- Global Shortcuts: Use keyboard shortcuts to activate the overlay and response windows.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/LunnosMp4/Perceptia.git
cd Perceptia
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables: Create a .env file in the root directory and add your Groq API key:
```
GROQ_API_KEY=your_groq_api_key
```

4. Run the application:
```
npm run start
```

## Usage
1. **Activate Overlay:** Press Control+Alt+N to activate the overlay and select a region of the screen.

2. **Select Action:**

    - **Summarize:** Click the "Summarize" button to get a summary of the selected region.
    - **Translate:** Select a language from the dropdown and click the "Translate" button to translate the content.
    - **Explain:** Click the "Explain" button to get a detailed explanation of the content.
    - **Answer:** Click the "Answer" button to get answers based on the content.
    - **Custom:** Click the "Custom" button, enter a custom prompt, and click "Confirm" to get a response based on your prompt.

4. **View Responses:** The response window will automatically open and display your response.

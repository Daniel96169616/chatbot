
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatInterface = document.getElementById('chat-interface');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const chatHistory = document.getElementById('chat-history');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // App State
    let apiKey = localStorage.getItem('gemini-api-key');
    let conversationHistory = [];
    const model = "gemini-1.5-flash-latest";
    const maxOutputTokens = 4000;

    // Initialization
    const init = () => {
        if (apiKey) {
            showChatInterface();
        } else {
            showApiKeySetup();
        }

        saveApiKeyButton.addEventListener('click', saveApiKey);
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    };

    // UI Switching
    const showApiKeySetup = () => {
        apiKeySetup.classList.remove('hidden');
        chatInterface.classList.add('hidden');
    };

    const showChatInterface = () => {
        apiKeySetup.classList.add('hidden');
        chatInterface.classList.remove('hidden');
    };

    // Save API Key with enhanced error handling
    const saveApiKey = () => {
        try {
            console.log("saveApiKey function called.");
            const key = apiKeyInput.value.trim();
            if (key) {
                apiKey = key;
                localStorage.setItem('gemini-api-key', key);
                console.log("API Key saved. Switching UI...");
                showChatInterface();
                console.log("showChatInterface function has been called.");
            } else {
                alert('請輸入有效的 API 金鑰。');
            }
        } catch (error) {
            console.error("Error in saveApiKey:", error);
            // Add error message to the DOM for visibility in screenshots
            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'red';
            errorDiv.textContent = `An unexpected error occurred: ${error.message}`;
            apiKeySetup.querySelector('.container').appendChild(errorDiv);
        }
    };

    // Add message to chat history
    const addMessage = (sender, text) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = text;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
        return messageElement;
    };

    // Send Message
    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        addMessage('user', messageText);
        messageInput.value = '';

        conversationHistory.push({ role: 'user', parts: [{ text: messageText }] });

        const loadingIndicator = addMessage('ai', '思考中...');
        loadingIndicator.classList.add('loading');

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: conversationHistory,
                    generationConfig: {
                        maxOutputTokens: maxOutputTokens,
                    }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'API 請求失敗');
            }

            const data = await response.json();
            const aiResponse = data.candidates[0].content.parts[0].text;

            loadingIndicator.remove();
            addMessage('ai', aiResponse);

            conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });

        } catch (error) {
            loadingIndicator.textContent = `錯誤: ${error.message}`;
            console.error('API Error:', error);
        }
    };

    // Start the app
    init();
});

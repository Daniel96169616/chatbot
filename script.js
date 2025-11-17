
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatInterface = document.getElementById('chat-interface');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const chatHistoryEl = document.getElementById('chat-history');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat-button');
    const conversationHistoryEl = document.getElementById('conversation-history');

    // App State
    let apiKey = localStorage.getItem('gemini-api-key');
    let currentConversation = [];
    let allConversations = JSON.parse(localStorage.getItem('gemini-conversations')) || {};
    let currentConversationId = null;
    const model = "gemini-1.5-flash-latest";
    const maxOutputTokens = 4000;

    // Initialization
    const init = () => {
        if (apiKey) {
            showChatInterface();
            loadConversationHistory();
            loadMostRecentConversation();
        } else {
            showApiKeySetup();
        }

        saveApiKeyButton.addEventListener('click', saveApiKey);
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        newChatButton.addEventListener('click', startNewChat);
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

    // Add message to chat history UI
    const addMessageToUI = (sender, text) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = text;
        chatHistoryEl.appendChild(messageElement);
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight; // Auto-scroll
        return messageElement;
    };

    // Start a new chat
    const startNewChat = () => {
        currentConversationId = `conversation_${Date.now()}`;
        currentConversation = [];
        chatHistoryEl.innerHTML = '';
        messageInput.value = '';
        // A new chat doesn't exist in the history yet, so no item can be active.
        // The active item will be set when the first message is sent.
        const items = conversationHistoryEl.querySelectorAll('.conversation-item');
        items.forEach(item => item.classList.remove('active'));
    };

    // Load the most recent conversation, or start a new one if none exist
    const loadMostRecentConversation = () => {
        const sortedIds = Object.keys(allConversations).sort((a, b) => parseInt(b.split('_')[1]) - parseInt(a.split('_')[1]));
        if (sortedIds.length > 0) {
            loadConversation(sortedIds[0]);
        } else {
            startNewChat();
        }
    };

    // Load a specific conversation
    const loadConversation = (id) => {
        if (!allConversations[id]) return;
        currentConversationId = id;
        currentConversation = allConversations[id];
        chatHistoryEl.innerHTML = '';
        currentConversation.forEach(msg => {
            // Check for the correct role property
            const role = msg.role === 'model' ? 'ai' : 'user';
            const text = msg.parts && msg.parts.length > 0 ? msg.parts[0].text : '';
            if (text) {
                addMessageToUI(role, text);
            }
        });
        updateActiveConversationItem();
    };


    // Save conversations to local storage
    const saveConversations = () => {
        allConversations[currentConversationId] = currentConversation;
        localStorage.setItem('gemini-conversations', JSON.stringify(allConversations));
    };

    // Update the visual state of the active conversation item
    const updateActiveConversationItem = () => {
        const items = conversationHistoryEl.querySelectorAll('.conversation-item');
        items.forEach(item => {
            if (item.dataset.conversationId === currentConversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    };

    // Load conversation history from storage and display it
    const loadConversationHistory = () => {
        conversationHistoryEl.innerHTML = '';
        const sortedIds = Object.keys(allConversations).sort((a, b) => b.split('_')[1] - a.split('_')[1]); // Sort by timestamp desc
        sortedIds.forEach(id => {
            const conversation = allConversations[id];
            if (conversation.length > 0) {
                const firstUserMessage = conversation.find(msg => msg.role === 'user');
                const title = firstUserMessage ? firstUserMessage.parts[0].text.substring(0, 30) + '...' : '新對話';

                const item = document.createElement('div');
                item.classList.add('conversation-item');
                item.textContent = title;
                item.dataset.conversationId = id;
                item.addEventListener('click', () => loadConversation(id));
                conversationHistoryEl.appendChild(item);
            }
        });
        updateActiveConversationItem();
    };

    // Send Message
    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        addMessageToUI('user', messageText);
        messageInput.value = '';

        currentConversation.push({ role: 'user', parts: [{ text: messageText }] });
        const isNewConversation = currentConversation.length === 1;

        // Save immediately to prevent data loss on error
        saveConversations();
        if (isNewConversation) {
            loadConversationHistory();
        } else {
            updateActiveConversationItem();
        }

        const loadingIndicator = addMessageToUI('ai', '思考中...');
        loadingIndicator.classList.add('loading');

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: currentConversation,
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
            addMessageToUI('ai', aiResponse);

            currentConversation.push({ role: 'model', parts: [{ text: aiResponse }] });
            saveConversations(); // Save again with the AI response

        } catch (error) {
            loadingIndicator.textContent = `錯誤: ${error.message}`;
            console.error('API Error:', error);
            // No need to save here, as the user message is already saved.
        }
    };

    // Start the app
    init();
});

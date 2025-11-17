
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiKeySetup = document.getElementById('api-key-setup');
    const mainContent = document.getElementById('main-content');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const chatHistory = document.getElementById('chat-history');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat-button');
    const conversationHistoryList = document.getElementById('conversation-history-list');
    const suggestedQuestionsContainer = document.getElementById('suggested-questions');
    const maskSelect = document.getElementById('mask-select');
    const addMaskButton = document.getElementById('add-mask-button');

    // App State
    let apiKey = localStorage.getItem('gemini-api-key');
    let conversations = JSON.parse(localStorage.getItem('gemini-conversations')) || {};
    let currentConversationId = localStorage.getItem('gemini-current-conversation-id') || null;
    let masks = JSON.parse(localStorage.getItem('gemini-masks')) || {};
    let currentMaskId = localStorage.getItem('gemini-current-mask-id') || 'default';
    const model = "gemini-1.5-flash-001";
    const maxOutputTokens = 4000;

    // Initialization
    const init = () => {
        if (apiKey) {
            showChatInterface();
        } else {
            showApiKeySetup();
        }

        saveApiKeyButton.addEventListener('click', saveApiKey);
        sendButton.addEventListener('click', () => sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        newChatButton.addEventListener('click', createNewChat);
        addMaskButton.addEventListener('click', addMask);
        maskSelect.addEventListener('change', (e) => switchMask(e.target.value));

        initializeMasks();
        renderMasks();

        renderConversationHistory();
        if (currentConversationId) {
            loadConversation(currentConversationId);
        } else if (Object.keys(conversations).length === 0) {
            createNewChat();
        } else {
            // Load the most recent conversation if none is active
            const recentId = Object.keys(conversations).sort((a, b) => conversations[b].timestamp - conversations[a].timestamp)[0];
            loadConversation(recentId);
        }
    };

    // UI Switching
    const showApiKeySetup = () => {
        apiKeySetup.classList.remove('hidden');
        mainContent.classList.add('hidden');
    };

    const showChatInterface = () => {
        apiKeySetup.classList.add('hidden');
        mainContent.classList.remove('hidden');
    };

    // Save API Key
    const saveApiKey = () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;
            localStorage.setItem('gemini-api-key', key);
            showChatInterface();
        } else {
            alert('請輸入有效的 API 金鑰。');
        }
    };

    // Conversation Management
    const createNewChat = () => {
        const newId = `conv_${Date.now()}`;
        conversations[newId] = {
            id: newId,
            title: '新的對話',
            history: [],
            timestamp: Date.now()
        };
        currentConversationId = newId;
        saveConversations();
        loadConversation(newId);
        renderConversationHistory();
    };

    const loadConversation = (id) => {
        if (!conversations[id]) return;
        currentConversationId = id;
        localStorage.setItem('gemini-current-conversation-id', id);
        chatHistory.innerHTML = '';
        const conversation = conversations[id];
        conversation.history.forEach(message => {
            addMessage(message.role === 'user' ? 'user' : 'ai', message.parts[0].text);
        });
        renderConversationHistory(); // To update active state
    };

    const saveConversations = () => {
        localStorage.setItem('gemini-conversations', JSON.stringify(conversations));
    };

    const renderConversationHistory = () => {
        conversationHistoryList.innerHTML = '';
        Object.values(conversations)
            .sort((a, b) => b.timestamp - a.timestamp)
            .forEach(conv => {
                const item = document.createElement('div');
                item.classList.add('conversation-item');
                item.textContent = conv.title;
                if (conv.id === currentConversationId) {
                    item.classList.add('active');
                }
                item.addEventListener('click', () => loadConversation(conv.id));
                conversationHistoryList.appendChild(item);
            });
    };


    // Add message to chat history UI
    const addMessage = (sender, text) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        if (sender === 'ai') {
            messageElement.innerHTML = marked.parse(text);
        } else {
            messageElement.textContent = text;
        }
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageElement;
    };

    // Send Message
    const sendMessage = async (messageText = null) => {
        if (messageText === null) {
            messageText = messageInput.value.trim();
        }
        if (!messageText || !currentConversationId) return;

        addMessage('user', messageText);
        messageInput.value = '';
        suggestedQuestionsContainer.innerHTML = ''; // Clear suggestions

        const currentHistory = conversations[currentConversationId].history;
        currentHistory.push({ role: 'user', parts: [{ text: messageText }] });

        if (currentHistory.length === 1) {
            conversations[currentConversationId].title = messageText.substring(0, 30);
            renderConversationHistory();
        }

        const loadingIndicator = addMessage('ai', '思考中...');
        loadingIndicator.classList.add('loading');

        try {
            const systemInstruction = {
                role: 'system',
                parts: [{ text: masks[currentMaskId]?.prompt || '' }]
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: currentHistory,
                    systemInstruction: systemInstruction,
                    generationConfig: { maxOutputTokens: maxOutputTokens }
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

            currentHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            conversations[currentConversationId].timestamp = Date.now();
            saveConversations();
            renderConversationHistory();

            generateSuggestedQuestions(messageText, aiResponse);

        } catch (error) {
            loadingIndicator.textContent = `錯誤: ${error.message}`;
            console.error('API Error:', error);
        }
    };

    const generateSuggestedQuestions = async (userQuestion, aiAnswer) => {
        try {
            const prompt = `根據以下對話，生成三個簡短、相關的後續問題建議，直接輸出問題，每個問題用換行符分隔：\n\n使用者問：「${userQuestion}」\nAI答：「${aiAnswer}」`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 100 }
                }),
            });
            if (!response.ok) throw new Error('無法生成建議問題');

            const data = await response.json();
            const suggestionsText = data.candidates[0].content.parts[0].text;
            const suggestions = suggestionsText.split('\n').filter(s => s.trim() !== '');
            renderSuggestedQuestions(suggestions);

        } catch (error) {
            console.error('建議問題生成失敗:', error);
        }
    };

    const renderSuggestedQuestions = (suggestions) => {
        suggestedQuestionsContainer.innerHTML = '';
        suggestions.forEach(text => {
            const btn = document.createElement('button');
            btn.textContent = text.replace(/^- /, ''); // Clean up list markers
            btn.classList.add('suggested-question-btn');
            btn.onclick = () => {
                sendMessage(text);
            };
            suggestedQuestionsContainer.appendChild(btn);
        });
    };

    // Mask Management
    const initializeMasks = () => {
        if (Object.keys(masks).length === 0) {
            masks = {
                'default': { id: 'default', name: '預設', prompt: '你是一個樂於助人的 AI 助理。' }
            };
            saveMasks();
        }
    };

    const renderMasks = () => {
        maskSelect.innerHTML = '';
        for (const id in masks) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = masks[id].name;
            if (id === currentMaskId) {
                option.selected = true;
            }
            maskSelect.appendChild(option);
        }
    };

    const addMask = () => {
        return new Promise((resolve) => {
            const name = prompt('請輸入面具名稱：');
            if (!name) return resolve();

            const confirmStatus = confirm(`為「${name}」新增一個面具嗎？`);
            if(!confirmStatus) return resolve();

            const promptText = '預設提示';
            const newId = `mask_${Date.now()}`;
            masks[newId] = { id: newId, name, prompt: promptText };
            saveMasks();
            switchMask(newId);
            renderMasks();
            resolve();
        });
    };

    const switchMask = (id) => {
        currentMaskId = id;
        localStorage.setItem('gemini-current-mask-id', id);
        // Optional: Clear conversation or notify user when mask changes
        // For now, it will apply to the next message in the current chat.
    };

    const saveMasks = () => {
        localStorage.setItem('gemini-masks', JSON.stringify(masks));
    };


    // Start the app
    init();
});

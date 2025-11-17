document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const recommendations = document.getElementById('recommendations');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');

    const recommendedQuestions = [
        '你好，請介紹一下自己',
        '用簡單的方式解釋什麼是 API',
        '給我三個學習 Github 的建議'
    ];

    function addMessage(message, sender = 'bot') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.innerText = message;
        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function showRecommendations() {
        recommendations.innerHTML = '';
        recommendedQuestions.forEach(question => {
            const button = document.createElement('button');
            button.classList.add('recommendation-btn');
            button.innerText = question;
            button.addEventListener('click', () => {
                userInput.value = question;
                chatForm.dispatchEvent(new Event('submit'));
            });
            recommendations.appendChild(button);
        });
    }

    function hideRecommendations() {
        recommendations.style.display = 'none';
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (userMessage) {
            addMessage(userMessage, 'user');
            userInput.value = '';
            if (recommendations.style.display !== 'none') {
                hideRecommendations();
            }
            // Bot response placeholder
            setTimeout(() => {
                addMessage(`You said: ${userMessage}`);
            }, 500);
        }
    });

    showRecommendations();
});
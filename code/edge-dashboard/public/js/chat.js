(function () {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input-text');
    const thread = document.getElementById('chat-thread');
    const sendButton = document.getElementById('send-btn');
    const conversationIdElement = document.getElementById('conv-id');
    const dataAnalysisButton = document.getElementById('chat-data-analysis-btn');
    let isDataAnalysisEnabled = true;

    function updateDataAnalysisVisuals() {
        if (!dataAnalysisButton) return;
        dataAnalysisButton.classList.toggle('btn-outline-success', !isDataAnalysisEnabled);
        dataAnalysisButton.classList.toggle('btn-success', isDataAnalysisEnabled);
        dataAnalysisButton.setAttribute('aria-pressed', isDataAnalysisEnabled ? 'true' : 'false');
        dataAnalysisButton.title = 'Analysis of clinical data';
    }

    dataAnalysisButton?.addEventListener('click', () => {
        isDataAnalysisEnabled = !isDataAnalysisEnabled;
        updateDataAnalysisVisuals();
    });
    updateDataAnalysisVisuals();

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    const adjustInputHeight = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    };
    input.addEventListener('input', adjustInputHeight);
    adjustInputHeight();

    const scrollToBottom = () => {
        thread.scrollTop = thread.scrollHeight;
    };

    function parseMarkdown(bubbleElement, rawContent) {
        const normalizedContent = (rawContent || '').replace(/<br\s*\/?>(\r?\n)?/gi, '\n').trim();
        const escapedContent = normalizedContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        if (window.marked) {
            bubbleElement.innerHTML = window.marked.parse(escapedContent);
            if (window.hljs) {
                bubbleElement.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
            }
        } else {
            bubbleElement.textContent = normalizedContent;
        }
        bubbleElement.dataset.markdownParsed = '1';
    }

    function addMessage(role, content, dataAnalysis = false) {
        const promptsContainer = document.getElementById('suggested-prompts');
        if (promptsContainer) {
            promptsContainer.remove();
        }

        const messageRow = document.createElement('div');
        messageRow.className = 'd-flex align-items-start gap-2 mb-3 ' + (role === 'user' ? 'flex-row-reverse' : '');

        const messageBubble = document.createElement('div');
        const baseClasses = 'border rounded-3 p-2 shadow-sm markdown';
        messageBubble.className = baseClasses + (role === 'user' ? ' bg-primary-subtle border-primary-subtle' : ' bg-white');

        if (dataAnalysis) {
            messageBubble.classList.add('position-relative', 'pe-4');
        }

        messageBubble.textContent = content || '';
        parseMarkdown(messageBubble, content || '');

        if (dataAnalysis) {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'position-absolute top-0 end-0 p-1 text-success';
            iconDiv.title = 'Data analysis active';
            iconDiv.innerHTML = `
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 3v18h18" />
              <rect x="7" y="10" width="2" height="7" />
              <rect x="11" y="6" width="2" height="11" />
              <rect x="15" y="13" width="2" height="4" />
            </svg>`;
            messageBubble.appendChild(iconDiv);
        }

        messageRow.appendChild(messageBubble);
        thread.appendChild(messageRow);
        scrollToBottom();
        return messageRow;
    }

    function showTypingIndicator() {
        const typingRow = document.createElement('div');
        typingRow.className = 'd-flex align-items-start gap-2 mb-3';
        typingRow.innerHTML = `
            <div class="typing-wrapper" aria-live="polite" aria-label="Generating response">
                <div class="spinner-grow text-dark" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`;
        thread.appendChild(typingRow);
        scrollToBottom();
        return typingRow;
    }

    const urlParams = new URLSearchParams(location.search);
    const sessionId = urlParams.get('sessionId');

    function cleanupOrphanedLoaders() {
        const loadingKey = `chat-loading-${sessionId}`;
        const isLoading = sessionStorage.getItem(loadingKey);
        
        if (isLoading === 'true') {
            sessionStorage.removeItem(loadingKey);
            thread.querySelectorAll('.typing-wrapper').forEach(el => {
                el.closest('.d-flex')?.remove();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        cleanupOrphanedLoaders();

        const suggestedPrompts = document.querySelectorAll('.suggested-prompt-card');
        suggestedPrompts.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                const analysis = card.dataset.analysis === 'true';
                
                if (prompt) {
                    isDataAnalysisEnabled = analysis;
                    updateDataAnalysisVisuals();
                    input.value = prompt;
                    adjustInputHeight();
                    form.requestSubmit();
                }
            });
        });
        
        if (!window.marked) return;
        thread.querySelectorAll('.markdown').forEach(bubble => {
            if (bubble.dataset.markdownParsed === '1') return;
            const rawContent = bubble.textContent || '';
            parseMarkdown(bubble, rawContent);
        });
        scrollToBottom();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const userMessage = input.value.trim();
        if (!userMessage) return;

        const loadingKey = `chat-loading-${sessionId}`;
        
        input.disabled = true;
        sendButton.disabled = true;
        addMessage('user', userMessage, isDataAnalysisEnabled);
        input.value = '';
        adjustInputHeight();
        const typingIndicatorRow = showTypingIndicator();
        
        sessionStorage.setItem(loadingKey, 'true');

        try {
            const response = await fetch('/api/chat/send?sessionId=' + encodeURIComponent(sessionId || ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    convId: conversationIdElement?.value,
                    message: userMessage,
                    dataAnalysis: isDataAnalysisEnabled
                })
            });
            const responseData = await response.json();
            typingIndicatorRow.remove();
            const botResponse = responseData?.answer || 'Ops something went wrong, please try again later.';
            addMessage('bot', botResponse);
        } catch (error) {
            typingIndicatorRow.remove();
            console.error('Failed to send message:', error);
             addMessage('bot', 'Ops something went wrong, please try again later.');
        } finally {
            sessionStorage.removeItem(loadingKey);
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
            adjustInputHeight();
        }
    });
})();
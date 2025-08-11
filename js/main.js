class PortfolioApp {
    constructor() {
        this.chatMessages = [];
        this.isInitialized = false;
        this.apiEndpoint = 'http://localhost:8000/agent/chat'; // Proxy 서버 엔드포인트 설정
        this.isProcessing = false;
        this.init();
    }

    // 서버 연결 상태 확인 및 에러 메시지 처리
    checkServerConnection() {
        if (!window.proxyAPI || !window.proxyAPI.isConnected) {
            this.showErrorMessage('서버에 연결되지 않아 요청을 처리할 수 없습니다.');
            return false;
        }
        return true;
    }

    // 에러 처리 헬퍼 함수
    handleConnectionError(error) {
        if (error.message.includes('프록시 서버')) {
            this.showErrorMessage('서버에 연결되지 않아 요청을 처리할 수 없습니다.');
        } else {
            this.showErrorMessage('처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    }

    // 채팅에서의 연결 에러 처리
    handleChatConnectionError(error) {
        if (error.message.includes('프록시 서버')) {
            this.addChatMessage('ai', '서버에 연결되지 않아 응답을 생성할 수 없습니다.');
        } else {
            this.addChatMessage('ai', '죄송합니다. 응답 처리 중 오류가 발생했습니다.');
        }
    }

    init() {
        // 채팅 관련 이벤트 리스너 설정
        this.setupEventListeners();
        this.isInitialized = true;
    }

    setupEventListeners() {
        // 엔터키로 메시지 전송
        const chatInput = document.getElementById('chat-input');
        const userInput = document.getElementById('user-input');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUserInput();
                }
            });
        }
    }

    // 퀵 버튼 클릭시 프롬프트 텍스트 설정
    setPromptText(text) {
        const input = document.getElementById('user-input');
        input.value = text;
        input.focus();
        
        // 자동으로 전송할지 선택 (옵션)
        // this.handleUserInput();
    }

    async handleUserInput() {
        const input = document.getElementById('user-input');
        const userMessage = input.value.trim();
        
        if (!userMessage || this.isProcessing) return;

        // 서버 연결 상태 확인
        if (!this.checkServerConnection()) return;

        // 로딩 상태 시작
        this.setLoadingState(true);
        input.value = '';

        try {
            // AI API로 사용자 쿼리 전송
            await this.processUserQueryWithAI(userMessage);
        } catch (error) {
            this.handleConnectionError(error);
        } finally {
            this.setLoadingState(false);
        }
    }

    async processUserQueryWithAI(query) {
        this.isProcessing = true;
        
        // 세션에 사용자 메시지 기록
        if (window.sessionManager) {
            window.sessionManager.addMessage('user', query, {
                page: 'home',
                timestamp: Date.now()
            });
        }
        
        // 사용자 메시지 표시
        this.showUserMessage(query);
        
        try {
            let result;
            
            if (!window.proxyAPI || !window.proxyAPI.isConnected) {
                // 서버 연결 실패시
                throw new Error('서버에 연결되지 않았습니다');
            }
            
            // Proxy API를 통한 실제 처리
            result = await window.proxyAPI.processStreamingQuery(query, {
                currentPage: 'home',
                onStream: (content, fullContent) => {
                    this.updateLastAIMessage(fullContent);
                }
            });
            
            // AI 응답 처리
            await this.handleAIResult(result, query);
            
        } catch (error) {
            // 연결 실패시 사용자에게 명확한 안내
            this.handleConnectionError(error);
        }
        
        this.isProcessing = false;
    }

    async handleAIResult(result, originalQuery) {
        // AI 응답 표시
        if (result.text) {
            this.updateLastAIMessage(result.text);
            
            // 세션에 AI 응답 기록
            if (window.sessionManager) {
                window.sessionManager.addMessage('ai', result.text, {
                    page: 'home',
                    actions: result.actions,
                    metadata: result.metadata
                });
            }
        }

        // 액션 처리
        if (result.actions && result.actions.length > 0) {
            for (const action of result.actions) {
                await this.handleActionWithApproval(action, result.text, originalQuery);
            }
        }
    }

    async handleActionWithApproval(action, aiResponse, originalQuery) {
        try {
            if (action.requires_approval !== false) {
                // 사용자 승인 요청
                const approval = await window.approvalSystem.requestApproval(
                    action.type,
                    action.params,
                    aiResponse,
                    { originalQuery, timestamp: Date.now() }
                );

                if (approval.approved) {
                    await this.executeAction(action);
                } else {
                }
            } else {
                // 승인 없이 즉시 실행
                await this.executeAction(action);
            }
        } catch (error) {
            
            if (error.message.includes('취소')) {
                this.showTemporaryMessage('작업이 취소되었습니다.', 'ai-message');
            } else {
                this.showErrorMessage('액션 실행 중 오류가 발생했습니다.');
            }
        }
    }

    async executeAction(action) {

        switch (action.type) {
            case 'navigate':
                if (action.params && action.params.page) {
                    // 페이지 이동 전에 현재 컨텍스트 업데이트
                    if (window.sessionManager) {
                        window.sessionManager.setCurrentContext({
                            page: action.params.page,
                            previousPage: 'home',
                            navigationTimestamp: Date.now()
                        });
                    }
                    
                    // 1.5초 후 페이지 이동
                    setTimeout(() => {
                        navigateToPage(action.params.page);
                    }, 1500);
                }
                break;
                
            case 'scroll':
                if (action.params && action.params.element) {
                    const element = document.getElementById(action.params.element);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                }
                break;
                
            case 'download':
                if (action.params && action.params.url) {
                    const a = document.createElement('a');
                    a.href = action.params.url;
                    a.download = action.params.filename || 'download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
                break;
                
            case 'external_link':
                if (action.params && action.params.url) {
                    window.open(action.params.url, '_blank');
                }
                break;
                
            default:
        }
    }


    async typeMessage(message) {
        const words = message.split(' ');
        let currentMessage = '';

        for (let i = 0; i < words.length; i++) {
            currentMessage += words[i] + ' ';
            this.updateLastAIMessage(currentMessage.trim());
            
            // 단어 사이 간격 (실제 타이핑 느낌)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
        }
    }


    // UI 헬퍼 함수들
    setLoadingState(isLoading) {
        const input = document.getElementById('user-input');
        const button = input?.nextElementSibling;
        
        if (isLoading) {
            input.disabled = true;
            input.placeholder = 'AI가 응답을 생성하고 있습니다...';
            if (button) {
                button.disabled = true;
                button.innerHTML = '<div class="loading-spinner"></div>';
            }
        } else {
            input.disabled = false;
            input.placeholder = '질문이나 원하는 내용을 입력해주세요...';
            if (button) {
                button.disabled = false;
                button.innerHTML = '전송';
            }
        }
    }

    showUserMessage(message) {
        // 메인 페이지에서는 시각적 피드백만 제공
        
        // 입력창 위에 사용자 메시지 임시 표시 (옵션)
        this.showTemporaryMessage(`질문: ${message}`, 'user-message');
    }

    showAIMessage(message) {
        
        // AI 응답을 입력창 위에 표시
        this.showTemporaryMessage(message, 'ai-message');
    }

    updateLastAIMessage(message) {
        // SSE로 스트리밍되는 메시지 업데이트
        const existingMessage = document.querySelector('.ai-message');
        if (existingMessage) {
            existingMessage.querySelector('.message-content').textContent = message;
        } else {
            this.showAIMessage(message);
        }
    }

    showTemporaryMessage(message, className) {
        // 기존 메시지 제거
        const existing = document.querySelector(`.${className}`);
        if (existing) existing.remove();

        const container = document.querySelector('.input-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `temporary-message ${className}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-close" onclick="this.parentElement.remove()">×</div>
        `;

        container.parentNode.insertBefore(messageDiv, container);

        // 8초 후 자동 제거
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 8000);
    }

    showErrorMessage(message) {
        this.showTemporaryMessage(`❌ ${message}`, 'error-message');
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        // 서버 연결 상태 확인
        if (!window.proxyAPI || !window.proxyAPI.isConnected) {
            this.addChatMessage('ai', '서버에 연결되지 않아 응답을 생성할 수 없습니다.');
            return;
        }

        // 채팅 메시지 추가
        this.addChatMessage('user', message);
        
        // 세션에 기록 (현재 페이지 정보 포함)
        if (window.sessionManager) {
            const currentPage = window.navigation?.currentPage || 'unknown';
            window.sessionManager.addMessage('user', message, {
                page: currentPage,
                source: 'floating_chat',
                timestamp: Date.now()
            });
        }

        input.value = '';

        try {
            // 비동기 작업 처리
            let result;
            
            if (!window.proxyAPI || !window.proxyAPI.isConnected) {
                // 서버 연결 실패시
                throw new Error('서버에 연결되지 않았습니다');
            }
            
            // Proxy API를 통한 실제 처리
            result = await window.proxyAPI.processQuery(message, {
                currentPage: window.navigation?.currentPage || 'unknown',
                chatContext: true
            });

            // AI 응답 표시
            if (result.text) {
                this.addChatMessage('ai', result.text);
                
                // 세션에 AI 응답 기록
                if (window.sessionManager) {
                    window.sessionManager.addMessage('ai', result.text, {
                        page: window.navigation?.currentPage || 'unknown',
                        source: 'floating_chat',
                        actions: result.actions,
                        metadata: result.metadata
                    });
                }
            }

            // 액션 처리 (플로팅 채팅에서는 승인 없이 실행)
            if (result.actions && result.actions.length > 0) {
                for (const action of result.actions) {
                    // 플로팅 채팅에서는 자동 승인
                    action.requires_approval = false;
                    await this.executeAction(action);
                }
            }

        } catch (error) {
            this.handleChatConnectionError(error);
        }
    }

    // 채팅 히스토리 로드 (세션에서)
    loadChatHistory(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // 기존 메시지 클리어
        messagesContainer.innerHTML = '';

        // 메시지 추가
        messages.forEach(msg => {
            const sender = msg.sender === 'user' ? 'user' : 'ai';
            this.addChatMessage(sender, msg.content, false); // 스크롤 없이 추가
        });

        // 마지막에 스크롤
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);

    }

    addChatMessage(sender, message, autoScroll = true) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const messageStyle = sender === 'user' 
            ? 'background: #667eea; color: white; margin-left: 20px; border-radius: 15px 15px 5px 15px;'
            : 'background: #f1f3f4; color: #333; margin-right: 20px; border-radius: 15px 15px 15px 5px;';
            
        messageDiv.innerHTML = `
            <div style="padding: 10px 15px; margin: 5px 0; ${messageStyle}">
                ${message}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        
        if (autoScroll) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }


    openChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');
        
        chatContainer.style.display = 'flex';
        chatFloatBtn.style.display = 'none';
        
        // 채팅 히스토리 동기화
        if (window.sessionManager) {
            window.sessionManager.syncToFloatingChat();
        }
        
        // 애니메이션을 위한 delay
        setTimeout(() => {
            chatContainer.classList.add('active');
        }, 10);
    }

    closeChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');
        
        chatContainer.classList.remove('active');
        
        setTimeout(() => {
            chatContainer.style.display = 'none';
            chatFloatBtn.style.display = 'flex';
        }, 300);
    }

    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const isActive = chatContainer.classList.contains('active');
        
        if (isActive) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
}

// 전역 함수들
function handleUserInput() {
    if (window.portfolioApp) {
        window.portfolioApp.handleUserInput();
    }
}

function setPromptText(text) {
    if (window.portfolioApp) {
        window.portfolioApp.setPromptText(text);
    }
}

function sendChatMessage() {
    if (window.portfolioApp) {
        window.portfolioApp.sendChatMessage();
    }
}

function openChat() {
    if (window.portfolioApp) {
        window.portfolioApp.openChat();
    }
}

function closeChat() {
    if (window.portfolioApp) {
        window.portfolioApp.closeChat();
    }
}

function toggleChat() {
    if (window.portfolioApp) {
        window.portfolioApp.toggleChat();
    }
}

function toggleTheme() {
    if (window.gradientManager) {
        window.gradientManager.toggleDarkMode();
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioApp = new PortfolioApp();
});
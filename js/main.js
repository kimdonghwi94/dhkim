class PortfolioApp {
    constructor() {
        this.chatMessages = [];
        this.isInitialized = false;
        this.apiEndpoint = 'http://localhost:8000/agent/chat'; // Proxy 서버 엔드포인트 설정
        this.isProcessing = false;
        this.isChatExpanded = false;

        // 이벤트 핸들러 참조 초기화
        this.chatInputHandler = null;
        this.userInputHandler = null;

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

        // 새로고침이 아닌 경우에만 채팅 기록 복원
        const isPageRefresh = performance.navigation.type === performance.navigation.TYPE_RELOAD ||
                             performance.getEntriesByType('navigation')[0]?.type === 'reload';

        if (!isPageRefresh && window.sessionManager) {
            const existingMessages = window.sessionManager.getChatHistory();
            if (existingMessages.length > 0) {
                console.log('기존 채팅 기록 복원 중:', existingMessages.length, '개 메시지');
                this.restoreChatHistory(existingMessages);
            }
        } else if (isPageRefresh) {
            console.log('새로고침 감지됨 - 채팅 기록 복원 안함');
            // 새로고침 시에는 채팅창 클리어
            this.clearAllChatMessages();

            // 추가적으로 내부 배열도 완전히 초기화
            this.chatMessages = [];

            // DOM에서도 모든 메시지 제거
            setTimeout(() => {
                this.clearAllChatMessages();
            }, 100);
        }
    }

    // 모든 채팅 메시지 클리어
    clearAllChatMessages() {
        // 메인 페이지 채팅 메시지 클리어
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }

        // 플로팅 채팅 메시지 클리어
        const floatingChatMessages = document.querySelector('#chat-container .chat-messages');
        if (floatingChatMessages) {
            floatingChatMessages.innerHTML = '';
        }

        // 내부 메시지 배열도 클리어
        this.chatMessages = [];

        console.log('모든 채팅 메시지 클리어됨');
    }

    setupEventListeners() {
        console.log('setupEventListeners 호출됨');

        // 기존 이벤트 리스너 제거 후 재설정
        const chatInput = document.getElementById('chat-input');
        const userInput = document.getElementById('user-input');

        console.log('chatInput 존재:', !!chatInput);
        console.log('userInput 존재:', !!userInput);

        if (chatInput) {
            // 기존 이벤트 리스너 제거
            chatInput.removeEventListener('keypress', this.chatInputHandler);

            // 새 이벤트 리스너 추가
            this.chatInputHandler = (e) => {
                console.log('chatInput keypress 이벤트 발생:', e.key);
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            };
            chatInput.addEventListener('keypress', this.chatInputHandler);
            console.log('chatInput 이벤트 리스너 설정 완료');
        }

        if (userInput) {
            // 기존 이벤트 리스너 제거
            userInput.removeEventListener('keypress', this.userInputHandler);

            // 새 이벤트 리스너 추가
            this.userInputHandler = (e) => {
                console.log('userInput keypress 이벤트 발생:', e.key);
                if (e.key === 'Enter') {
                    this.handleUserInput();
                }
            };
            userInput.addEventListener('keypress', this.userInputHandler);
            console.log('userInput 이벤트 리스너 설정 완료');
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
        console.log('handleUserInput 호출됨!');
        const input = document.getElementById('user-input');
        console.log('input 요소:', input);
        const userMessage = input.value.trim();
        console.log('사용자 메시지:', userMessage);
        console.log('처리 중 상태:', this.isProcessing);

        if (!userMessage || this.isProcessing) {
            console.log('처리 중이거나 메시지가 없음');
            return;
        }

        // 서버 연결 상태 확인
        if (!this.checkServerConnection()) {
            return;
        }

        // 채팅창 확장 (처음 메시지일 때)
        if (!this.isChatExpanded) {
            this.expandChat();
        }

        // 로딩 상태 시작
        this.setLoadingState(true);
        input.value = '';

        // 채팅창에 사용자 메시지 추가
        this.addChatMessage('user', userMessage);

        try {
            // AI API로 사용자 쿼리 전송
            await this.processUserQueryWithAI(userMessage);
        } catch (error) {
            // processUserQueryWithAI에서 이미 에러 처리됨
        } finally {
            this.setLoadingState(false);
        }
    }

    async processUserQueryWithAI(query) {
        this.isProcessing = true;

        let result = null;
        let aiMessageId = null;

        // 세션에 사용자 메시지 기록
        if (window.sessionManager) {
            window.sessionManager.addMessage('user', query, {
                page: 'home',
                timestamp: Date.now()
            });
        }

        // 타이핑 인디케이터 표시
        this.showTypingIndicator();

        try {
            if (!window.proxyAPI || !window.proxyAPI.isConnected) {
                // 서버 연결 실패시
                throw new Error('서버에 연결되지 않았습니다');
            }

            // AI 응답 메시지 미리 추가 (빈 메시지)
            aiMessageId = this.addChatMessage('ai', '', false);

            // Proxy API를 통한 실제 처리
            result = await window.proxyAPI.processStreamingQuery(query, {
                currentPage: 'home',
                onStream: (content, fullContent) => {
                    this.updateChatMessage(aiMessageId, fullContent);
                }
            });

            // 타이핑 인디케이터 제거
            this.hideTypingIndicator();

            // AI 응답 처리
            await this.handleAIResult(result, query);

            // 결과가 비어있다면 fallback이 실행된 것이므로 결과 확인
            if (result && result.text && aiMessageId) {
                // 메시지 업데이트
                this.updateChatMessage(aiMessageId, result.text);
            }

        } catch (error) {
            this.hideTypingIndicator();
            // 연결 실패시 사용자에게 명확한 안내
            this.addChatMessage('ai', '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
            this.handleConnectionError(error);
        } finally {
            // 항상 처리 상태 해제
            this.isProcessing = false;
        }
    }

    async handleAIResult(result, originalQuery) {
        console.log('handleAIResult 호출됨:', result);
        // AI 응답은 이미 processUserQueryWithAI에서 스트리밍으로 처리됨
        // 여기서는 세션 기록과 액션 처리만 수행
        if (result.text) {
            console.log('AI 응답 텍스트 처리 중:', result.text.substring(0, 100) + '...');

            // 최종 메시지에 시간 추가
            const messageElements = document.querySelectorAll('.chat-message.ai');
            console.log('AI 메시지 요소 개수:', messageElements.length);
            if (messageElements.length > 0) {
                const lastMessage = messageElements[messageElements.length - 1];
                if (lastMessage && lastMessage.id) {
                    this.addTimeToMessage(lastMessage.id);
                }
            }

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
            console.log('액션 처리 시작. 액션 개수:', result.actions.length);
            console.log('액션 목록:', result.actions);
            try {
                for (const action of result.actions) {
                    console.log('액션 처리 중:', action);
                    await this.handleActionWithApproval(action, result.text, originalQuery);
                }
            } catch (actionError) {
                console.error('액션 처리 중 에러:', actionError);
                // 액션 처리 중 에러가 발생해도 전체 프로세스는 계속 진행
            }
        } else {
            console.log('처리할 액션이 없습니다. result.actions:', result.actions);
        }
    }

    async handleActionWithApproval(action, aiResponse, originalQuery) {
        console.log('handleActionWithApproval 호출됨:', action);
        console.log('approvalSystem 존재 여부:', !!window.approvalSystem);
        console.log('approvalSystem 상태:', window.approvalSystem);

        try {
            if (action.requires_approval !== false) {
                console.log('승인이 필요한 액션입니다. 승인 요청 중...');

                // 승인 시스템이 없으면 강제로 재생성
                if (!window.approvalSystem) {
                    console.warn('승인 시스템이 없어서 재생성합니다');
                    window.approvalSystem = new ApprovalSystem();
                }

                // 사용자 승인 요청
                const approval = await window.approvalSystem.requestApproval(
                    action.type,
                    action.params,
                    aiResponse,
                    { originalQuery, timestamp: Date.now() }
                );
                console.log('승인 결과:', approval);

                if (approval.approved) {
                    console.log('액션이 승인되었습니다. 실행 중...');
                    await this.executeAction(action);
                }
            } else {
                console.log('승인 없이 즉시 실행');
                // 승인 없이 즉시 실행
                await this.executeAction(action);
            }
        } catch (error) {
            console.error('handleActionWithApproval 에러:', error);

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
        // 부모 요소에서 버튼을 찾아보기
        const button = input?.nextElementSibling ||
                      input?.parentElement?.querySelector('button');

        if (!input) {
            return;
        }

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

        // 새로운 구조에 맞는 컨테이너 찾기
        const container = document.querySelector('.chat-input-area') ||
                         document.querySelector('.input-container');

        if (!container) {
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `temporary-message ${className}`;

        messageDiv.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-close" onclick="this.parentElement.remove()">×</div>
        `;

        // 컨테이너가 존재하는지 확인 후 삽입
        if (container.parentNode) {
            container.parentNode.insertBefore(messageDiv, container);
        } else {
            // 부모가 없으면 body에 추가
            document.body.appendChild(messageDiv);
        }

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

        if (!message || this.isProcessing) return;

        // 플로팅 채팅 메시지 컨테이너 확인
        let messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            messagesContainer = document.querySelector('#chat-container .chat-messages');
        }

        // 처리 중 상태로 설정
        this.isProcessing = true;

        // 입력창 비활성화 및 로딩 표시
        this.setFloatingChatLoadingState(true);

        // 채팅 메시지 추가 - 플로팅 채팅용 함수 사용
        this.addFloatingChatMessage('user', message);
        
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

        // 타이핑 인디케이터 표시
        this.showFloatingTypingIndicator();

        try {
            // 비동기 작업 처리
            let result;

            if (!window.proxyAPI || !window.proxyAPI.isConnected) {
                // 서버 연결 실패시
                throw new Error('서버에 연결되지 않았습니다');
            }

            // AI 응답 메시지 미리 추가 (빈 메시지)
            const aiMessageElement = this.addFloatingChatMessage('ai', '', false);

            // Proxy API를 통한 실제 처리 (스트리밍)
            result = await window.proxyAPI.processQuery(message, {
                currentPage: window.navigation?.currentPage || 'unknown',
                chatContext: true,
                onStream: (content, fullContent) => {
                    // 스트리밍 중 메시지 업데이트
                    if (aiMessageElement) {
                        const contentElement = aiMessageElement.querySelector('.chat-message-content');
                        if (contentElement) {
                            contentElement.innerHTML = this.renderMarkdown(fullContent);
                        }
                    }
                }
            });

            // 타이핑 인디케이터 제거
            this.hideFloatingTypingIndicator();

            // AI 응답 표시 - 최종 메시지 업데이트
            if (result.text && aiMessageElement) {
                const contentElement = aiMessageElement.querySelector('.chat-message-content');
                if (contentElement) {
                    contentElement.innerHTML = this.renderMarkdown(result.text);
                }

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

            // 액션 처리 (플로팅 채팅에서도 승인 요청)
            if (result.actions && result.actions.length > 0) {
                for (const action of result.actions) {
                    // 플로팅 채팅에서도 승인이 필요한 경우 승인 요청
                    await this.handleActionWithApproval(action, result.text, message);
                }
            }

        } catch (error) {
            this.hideFloatingTypingIndicator();
            this.handleChatConnectionError(error);
        } finally {
            // 처리 완료 후 입력창 활성화
            this.isProcessing = false;
            this.setFloatingChatLoadingState(false);
        }
    }

    // 채팅 히스토리 로드 (세션에서)
    loadChatHistory(messages) {
        // 플로팅 채팅 메시지 컨테이너 찾기
        let messagesContainer = document.getElementById('chat-messages');

        // 메인 페이지가 아닌 경우 (플로팅 채팅)
        if (!messagesContainer) {
            messagesContainer = document.querySelector('#chat-container .chat-messages');
        }

        if (!messagesContainer) return;

        // 기존 메시지 클리어
        messagesContainer.innerHTML = '';

        // 메시지 추가
        messages.forEach(msg => {
            const sender = msg.sender === 'user' ? 'user' : 'ai';
            this.addFloatingChatMessage(sender, msg.content, false); // 플로팅 채팅 메시지 추가 함수 사용
        });

        // 마지막에 스크롤
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);

    }

    // 메인 페이지 채팅창에 전체 대화 기록 복원
    restoreChatHistory(messages) {
        // 메인 페이지의 중앙 채팅창 컨테이너
        const messagesContainer = document.getElementById('chat-messages-list');
        if (!messagesContainer) return;

        // 기존 메시지 클리어
        messagesContainer.innerHTML = '';

        // 메시지 추가
        messages.forEach(msg => {
            const sender = msg.sender === 'user' ? 'user' : 'ai';
            this.addChatMessage(sender, msg.content, false); // 중앙 채팅창용 함수 사용, 시간 표시 없음
        });

        // 마지막에 스크롤
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }

    // 채팅 기능 재초기화 (메인 페이지로 돌아올 때)
    reinitializeChat() {
        console.log('=== 채팅 기능 재초기화 시작 ===');

        const userInput = document.getElementById('user-input');
        console.log('user-input 요소 존재:', !!userInput);

        // 이벤트 리스너 재설정
        this.setupEventListeners();

        // 처리 상태 초기화
        this.isProcessing = false;
        this.isChatExpanded = false;

        // 로딩 상태 해제 (입력 필드 활성화)
        this.setLoadingState(false);

        console.log('=== 채팅 기능 재초기화 완료 ===');
    }

    addFloatingChatMessage(sender, message, autoScroll = true) {
        // 플로팅 채팅 메시지 컨테이너 찾기
        let messagesContainer = document.getElementById('chat-messages');

        // 메인 페이지가 아닌 경우 (플로팅 채팅)
        if (!messagesContainer) {
            messagesContainer = document.querySelector('#chat-container .chat-messages');
        }

        if (!messagesContainer) return null;

        const messageDiv = document.createElement('div');
        // 메인 채팅창과 동일한 클래스 구조 사용
        messageDiv.className = `chat-message ${sender}`;

        const messageStyle = sender === 'user'
            ? 'background: #667eea; color: white; margin-left: 20px; border-radius: 15px 15px 5px 15px; word-wrap: break-word; overflow-wrap: break-word; max-width: 85%;'
            : 'background: #f1f3f4; color: #333; margin-right: 20px; border-radius: 15px 15px 15px 5px; word-wrap: break-word; overflow-wrap: break-word; max-width: 85%;';

        // AI 메시지인 경우 마크다운으로 렌더링, 사용자 메시지는 일반 텍스트
        const renderedMessage = sender === 'ai' ? this.renderMarkdown(message) : message;

        messageDiv.innerHTML = `
            <div class="chat-message-content" style="padding: 10px 15px; margin: 5px 0; ${messageStyle}">
                ${renderedMessage}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);

        if (autoScroll) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        return messageDiv;
    }

    // 플로팅 채팅 로딩 상태 설정
    setFloatingChatLoadingState(isLoading) {
        const input = document.getElementById('chat-input');
        const button = input?.nextElementSibling || input?.parentElement?.querySelector('button');

        if (!input) return;

        if (isLoading) {
            input.disabled = true;
            input.placeholder = 'AI가 응답을 생성하고 있습니다...';
            if (button) {
                button.disabled = true;
                button.innerHTML = '<div class="loading-spinner"></div>';
            }
        } else {
            input.disabled = false;
            input.placeholder = '궁금한 것을 물어보세요...';
            if (button) {
                button.disabled = false;
                button.innerHTML = '전송';
            }
        }
    }

    // 플로팅 채팅 타이핑 인디케이터 표시
    showFloatingTypingIndicator() {
        let messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            messagesContainer = document.querySelector('#chat-container .chat-messages');
        }
        if (!messagesContainer) return;

        // 기존 인디케이터 제거
        this.hideFloatingTypingIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'floating-typing-indicator';
        indicator.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 플로팅 채팅 타이핑 인디케이터 제거
    hideFloatingTypingIndicator() {
        const indicator = document.getElementById('floating-typing-indicator');
        if (indicator && indicator.parentNode) {
            indicator.remove();
        }
    }



    openChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');

        // 홈 페이지에 있다면 중앙 채팅으로 확장, 그렇지 않으면 플로팅 채팅 열기
        if (this.isOnHomePage()) {
            this.expandToCentralChat();
        } else {
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
    }

    // 홈 페이지인지 확인
    isOnHomePage() {
        const pageContent = document.getElementById('page-content');
        return !pageContent || pageContent.style.display === 'none';
    }

    // 플로팅 채팅을 중앙 채팅으로 확장
    expandToCentralChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');
        const chatWrapper = document.getElementById('chat-wrapper');

        // 플로팅 채팅 닫기
        if (chatContainer) {
            chatContainer.classList.remove('active');
            setTimeout(() => {
                chatContainer.style.display = 'none';
                if (chatFloatBtn) {
                    chatFloatBtn.style.display = 'none';
                }
            }, 300);
        }

        // 플로팅 채팅 기록을 중앙 채팅으로 동기화
        this.syncFloatingToCentral();

        // 중앙 채팅 활성화
        setTimeout(() => {
            if (chatWrapper) {
                chatWrapper.style.display = 'block';
                setTimeout(() => {
                    this.expandChat();
                }, 100);
            }
        }, 400);
    }

    // 플로팅 채팅 기록을 중앙 채팅으로 동기화
    syncFloatingToCentral() {
        const floatingMessages = document.getElementById('chat-messages');
        const centralMessages = document.getElementById('chat-messages-list');

        if (floatingMessages && centralMessages) {
            // 기존 중앙 채팅 메시지 클리어
            centralMessages.innerHTML = '';

            // 플로팅 채팅의 메시지들을 중앙 채팅으로 복사
            const messages = floatingMessages.querySelectorAll('.message');
            messages.forEach(message => {
                const messageClone = message.cloneNode(true);
                // 중앙 채팅 스타일에 맞게 클래스 조정
                messageClone.className = messageClone.className.replace('message', 'chat-message');
                centralMessages.appendChild(messageClone);
            });

            // 스크롤을 맨 아래로
            setTimeout(() => {
                centralMessages.scrollTop = centralMessages.scrollHeight;
            }, 100);
        }
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

    // 채팅 확장/축소 관련 함수들
    expandChat() {
        const chatWrapper = document.getElementById('chat-wrapper');
        const mainContent = document.querySelector('.main-content');

        if (chatWrapper && !this.isChatExpanded) {
            // 메인 컨테이너에 확장 클래스 추가
            if (mainContent) {
                mainContent.classList.add('chat-expanded');
            }

            // expanding 애니메이션 클래스 추가
            chatWrapper.classList.add('expanding');

            // 조금 뒤에 expanded 클래스 추가 (메시지 영역 표시)
            setTimeout(() => {
                chatWrapper.classList.add('expanded');
                chatWrapper.classList.remove('expanding');
                this.isChatExpanded = true;

                // 메시지 영역 스크롤 조정
                const messagesList = document.getElementById('chat-messages-list');
                if (messagesList) {
                    messagesList.scrollTop = messagesList.scrollHeight;
                }

                // 이벤트 리스너 재설정
                this.setupEventListeners();
            }, 200);

            // 포커스 설정
            setTimeout(() => {
                const userInput = document.getElementById('user-input');
                if (userInput) userInput.focus();
            }, 1200);
        }
    }

    toggleChatExpand() {
        // 최소화 버튼이 제거되었으므로 이 함수는 더 이상 사용되지 않음
        return;
    }

    // 중앙 채팅을 우측 하단 플로팅 채팅으로 이동
    moveToFloatingChat() {
        const chatWrapper = document.getElementById('chat-wrapper');
        const mainContent = document.querySelector('.main-content');
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');

        // 메인 컨테이너에서 확장 클래스 제거
        if (mainContent) {
            mainContent.classList.remove('chat-expanded');
        }

        // 채팅 기록을 플로팅 채팅으로 복사
        this.syncChatToFloating();

        // 중앙 채팅창 숨기기
        if (chatWrapper) {
            chatWrapper.classList.remove('expanded');
            setTimeout(() => {
                chatWrapper.style.display = 'none';
            }, 500);
        }

        // 플로팅 채팅 즉시 활성화
        if (chatContainer && chatFloatBtn) {
            chatContainer.style.display = 'flex';
            setTimeout(() => {
                chatContainer.classList.add('active');
            }, 10);
        }

        this.isChatExpanded = false;
    }

    // 중앙 채팅 기록을 플로팅 채팅으로 동기화
    syncChatToFloating() {
        const centralMessages = document.getElementById('chat-messages-list');
        const floatingMessages = document.getElementById('chat-messages');

        if (centralMessages && floatingMessages) {
            // 기존 플로팅 채팅 메시지 클리어
            floatingMessages.innerHTML = '';

            // 중앙 채팅의 메시지들을 플로팅 채팅으로 복사
            const messages = centralMessages.querySelectorAll('.chat-message');
            messages.forEach(message => {
                const messageClone = message.cloneNode(true);
                // 플로팅 채팅 스타일에 맞게 클래스 조정
                messageClone.className = messageClone.className.replace('chat-message', 'message');
                floatingMessages.appendChild(messageClone);
            });

            // 스크롤을 맨 아래로
            setTimeout(() => {
                floatingMessages.scrollTop = floatingMessages.scrollHeight;
            }, 100);
        }
    }

    addChatMessage(sender, message, withTime = true) {
        const messagesContainer = document.getElementById('chat-messages-list');
        if (!messagesContainer) return null;

        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.id = messageId;

        const time = withTime ? new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        }) : '';

        // AI 메시지인 경우 마크다운으로 렌더링, 사용자 메시지는 일반 텍스트
        const renderedMessage = sender === 'ai' ? this.renderMarkdown(message) : message;

        messageDiv.innerHTML = `
            <div class="chat-message-bubble">
                <div class="chat-message-content">${renderedMessage}</div>
                ${withTime ? `<div class="chat-message-time">${time}</div>` : ''}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 메시지 저장
        this.chatMessages.push({ sender, message, time, id: messageId });

        return messageId;
    }

    updateChatMessage(messageId, newContent) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.chat-message-content');
            if (contentElement) {
                // AI 메시지인 경우 마크다운으로 렌더링
                if (messageElement.classList.contains('ai')) {
                    contentElement.innerHTML = this.renderMarkdown(newContent);
                } else {
                    contentElement.textContent = newContent;
                }
            }
        } else {
            // 메시지 요소가 없으면 새로 생성
            this.addChatMessage('ai', newContent);
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages-list');
        if (!messagesContainer) return;

        // 기존 인디케이터 제거
        this.hideTypingIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator && indicator.parentNode) {
            indicator.remove();
        }
    }

    // 메시지 시간 추가 함수
    addTimeToMessage(messageId) {
        if (!messageId) return;

        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const time = new Date().toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const bubbleElement = messageElement.querySelector('.chat-message-bubble');
            if (bubbleElement && !bubbleElement.querySelector('.chat-message-time')) {
                bubbleElement.innerHTML += `<div class="chat-message-time">${time}</div>`;
            }
        }
    }

    // 마크다운 렌더링 함수
    renderMarkdown(text) {
        if (!text) return '';

        try {
            // marked.js를 사용하여 마크다운을 HTML로 변환
            if (typeof marked !== 'undefined') {
                // marked 옵션 설정
                marked.setOptions({
                    breaks: true, // 줄바꿈을 <br>로 변환
                    gfm: true, // GitHub Flavored Markdown 지원
                    sanitize: false // HTML 태그 허용 (보안상 주의 필요하지만 AI 응답은 신뢰할 수 있음)
                });

                return marked.parse(text);
            } else {
                // marked가 로드되지 않은 경우 기본 처리
                return this.basicMarkdownParse(text);
            }
        } catch (error) {
            // 마크다운 파싱 실패시 기본 처리
            return this.basicMarkdownParse(text);
        }
    }

    // 기본 마크다운 파싱 (marked가 없을 때 사용)
    basicMarkdownParse(text) {
        if (!text) return '';

        return text
            // 줄바꿈 처리
            .replace(/\n/g, '<br>')
            // 볼드 텍스트
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 이탤릭 텍스트
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // 코드 블록 (간단한 처리)
            .replace(/`([^`]+)`/g, '<code>$1</code>');
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

function toggleChatExpand() {
    if (window.portfolioApp) {
        window.portfolioApp.toggleChatExpand();
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioApp = new PortfolioApp();
});
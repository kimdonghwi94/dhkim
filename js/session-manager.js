class SessionManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = {};
        this.init();
    }

    init() {
        // 새로고침 감지 (performance.navigation API 사용)
        const isPageRefresh = performance.navigation.type === performance.navigation.TYPE_RELOAD ||
                             performance.getEntriesByType('navigation')[0]?.type === 'reload';

        if (isPageRefresh) {
            console.log('새로고침 감지됨 - 세션 초기화');
            // 새로고침 시에는 세션 완전 초기화
            this.cleanupOldData(); // 먼저 기존 데이터 삭제
            this.sessionId = this.generateSessionId();
            this.chatHistory = [];
            this.currentContext = { page: 'home' };
            // 새로고침 시에는 저장하지 않음 (메모리에만 유지)
        } else {
            console.log('일반 페이지 로드 - 세션 복원 시도');
            // 페이지 전환 시에는 기존 세션 복원
            const sessionLoaded = this.loadSession();

            if (!sessionLoaded || this.isSessionExpired()) {
                // 세션이 없거나 만료된 경우만 새로 시작
                this.sessionId = this.generateSessionId();
                this.chatHistory = [];
                this.currentContext = { page: 'home' };
                this.saveSession();
            }
        }

        console.log('세션 초기화됨:', this.sessionId, '대화기록 수:', this.chatHistory.length);
    }

    // 기존 localStorage 데이터 정리
    cleanupOldData() {
        try {
            // 모든 포트폴리오 관련 localStorage 데이터 삭제
            localStorage.removeItem('portfolio_session');
            localStorage.removeItem('portfolio_session_id');

            // 혹시 다른 키로 저장된 데이터도 확인해서 삭제
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('portfolio') || key.includes('session') || key.includes('chat'))) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('localStorage 삭제됨:', key);
            });

            console.log('localStorage 정리 완료. 삭제된 항목 수:', keysToRemove.length);
        } catch (error) {
            console.error('localStorage 정리 실패:', error);
        }
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 대화 기록 추가
    addMessage(sender, content, metadata = {}) {
        // 중복 메시지 방지
        const lastMessage = this.chatHistory[this.chatHistory.length - 1];
        if (lastMessage && 
            lastMessage.sender === sender && 
            lastMessage.content === content && 
            Date.now() - lastMessage.timestamp < 1000) {
            // Duplicate message ignored
            return lastMessage;
        }

        // 현재 페이지 정보가 없으면 컨텍스트에서 가져오기
        if (!metadata.page) {
            metadata.page = this.currentContext.page || 'home';
        }

        const message = {
            id: this.generateMessageId(),
            sender, // 'user' | 'ai' | 'system'
            content,
            timestamp: Date.now(),
            metadata, // 페이지, 액션 등 추가 정보
            sessionId: this.sessionId
        };

        this.chatHistory.push(message);
        this.saveSession();
        
        // Message added
        return message;
    }

    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    // 현재 페이지 컨텍스트 설정
    setCurrentContext(context) {
        this.currentContext = {
            ...this.currentContext,
            ...context,
            timestamp: Date.now()
        };
        this.saveSession();
    }

    // 대화 히스토리 가져오기
    getChatHistory(limit = null) {
        if (limit) {
            return this.chatHistory.slice(-limit);
        }
        return this.chatHistory;
    }

    // 특정 페이지의 대화 기록만 가져오기
    getChatHistoryByPage(page) {
        return this.chatHistory.filter(msg => 
            msg.metadata.page === page || 
            msg.metadata.targetPage === page
        );
    }

    // 세션 저장 (localStorage 사용)
    saveSession() {
        try {
            const sessionData = {
                sessionId: this.sessionId,
                chatHistory: this.chatHistory,
                currentContext: this.currentContext,
                lastUpdated: Date.now()
            };
            localStorage.setItem('portfolio_session', JSON.stringify(sessionData));
        } catch (error) {
            console.error('세션 저장 실패:', error);
        }
    }

    // 세션 로드 (localStorage에서)
    loadSession() {
        try {
            const sessionData = localStorage.getItem('portfolio_session');
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                this.sessionId = parsed.sessionId || this.generateSessionId();
                this.chatHistory = parsed.chatHistory || [];
                this.currentContext = parsed.currentContext || { page: 'home' };
                return true;
            }
        } catch (error) {
            console.error('세션 로드 실패:', error);
        }
        return false;
    }

    // 세션이 만료되었는지 확인 (24시간 이상 지난 경우)
    isSessionExpired() {
        try {
            const sessionData = localStorage.getItem('portfolio_session');
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                const lastUpdated = parsed.lastUpdated || 0;
                const now = Date.now();
                const dayInMs = 24 * 60 * 60 * 1000;
                return (now - lastUpdated) > dayInMs;
            }
        } catch (error) {
            return true;
        }
        return true;
    }

    // 새 세션 시작
    startNewSession() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = {};
        this.saveSession();
        
        // New session started
    }

    // 세션 초기화 (메모리에서만)
    clearSession() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = { page: 'home' };
        // Session initialized in memory
    }

    // 개발/디버그용 세션 상태 확인
    debugSession() {
        // Session debug info (disabled)
    }

    // 대화 요약 생성 (API용)
    generateConversationSummary(maxMessages = 10) {
        const recentMessages = this.getChatHistory(maxMessages);
        
        return {
            sessionId: this.sessionId,
            messageCount: this.chatHistory.length,
            recentMessages: recentMessages.map(msg => ({
                sender: msg.sender,
                content: msg.content.substring(0, 200), // 내용 축약
                timestamp: msg.timestamp,
                page: msg.metadata.page
            })),
            currentContext: this.currentContext
        };
    }

    // MCP 호출용 컨텍스트 준비
    prepareMCPContext() {
        const context = {
            session_id: this.sessionId,
            chat_history: this.getChatHistory(5), // 최근 5개 메시지
            current_page: this.currentContext.page || 'home',
            user_preferences: this.currentContext.preferences || {},
            conversation_summary: this.generateConversationSummary()
        };

        return context;
    }

    // 페이지별 대화 히스토리를 플로팅 채팅에 동기화
    syncToFloatingChat() {
        const currentPage = this.currentContext.page;
        if (!currentPage || currentPage === 'home') {
            // Home page floating chat sync disabled
            return;
        }

        // 메인 페이지와 현재 페이지의 모든 대화 기록
        const relevantMessages = this.chatHistory.filter(msg => {
            if (!msg.metadata) return false;
            
            return msg.metadata.page === 'home' || 
                   msg.metadata.page === currentPage || 
                   msg.metadata.targetPage === currentPage ||
                   msg.metadata.relatedPages?.includes(currentPage) ||
                   msg.metadata.source === 'floating_chat'; // 플로팅 채팅 메시지도 포함
        });

        // 시간 순으로 정렬
        relevantMessages.sort((a, b) => a.timestamp - b.timestamp);

        // 플로팅 채팅창에 메시지 표시
        if (window.portfolioApp && typeof window.portfolioApp.loadChatHistory === 'function') {
            window.portfolioApp.loadChatHistory(relevantMessages);
            // Page messages synchronized
        } else {
            // portfolioApp.loadChatHistory function not found
        }

        // 디버그 정보
        if (relevantMessages.length === 0) {
            // No messages to sync
        }
    }
}

// 전역 세션 매니저 인스턴스
window.sessionManager = new SessionManager();

// 개발자도구에서 사용할 수 있는 디버그 함수들
window.debugSession = () => window.sessionManager.debugSession();
window.clearSession = () => window.sessionManager.clearSession();
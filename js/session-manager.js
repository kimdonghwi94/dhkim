class SessionManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = {};
        this.init();
    }

    init() {
        // 기존 localStorage 데이터 정리
        this.cleanupOldData();
        
        // 매번 새로운 세션 시작 (localStorage 사용 안함)
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = { page: 'home' };
        
        // New session started
    }

    // 기존 localStorage 데이터 정리
    cleanupOldData() {
        try {
            localStorage.removeItem('portfolio_session');
            localStorage.removeItem('portfolio_session_id');
        } catch (error) {
            // localStorage cleanup failed
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

    // 세션 저장 (메모리에서만 관리, localStorage 사용 안함)
    saveSession() {
        // 페이지 새로고침시 초기화되도록 localStorage 저장하지 않음
        // Session memory saved
    }

    // 세션 로드 (사용하지 않음 - 매번 새로 시작)
    loadSession() {
        // 매번 새로운 세션을 시작하므로 로드하지 않음
        return false;
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
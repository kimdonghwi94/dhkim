class SessionManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = {};
        this.init();
    }

    init() {
        // 기존 세션 복구 시도
        this.loadSession();
        console.log('세션 관리자 초기화:', this.sessionId);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 대화 기록 추가
    addMessage(sender, content, metadata = {}) {
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
        
        console.log('메시지 추가:', message);
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

    // 세션 저장 (localStorage)
    saveSession() {
        const sessionData = {
            sessionId: this.sessionId,
            chatHistory: this.chatHistory,
            currentContext: this.currentContext,
            lastUpdated: Date.now()
        };

        try {
            localStorage.setItem('portfolio_session', JSON.stringify(sessionData));
            localStorage.setItem('portfolio_session_id', this.sessionId);
        } catch (error) {
            console.error('세션 저장 실패:', error);
        }
    }

    // 세션 로드
    loadSession() {
        try {
            const sessionData = localStorage.getItem('portfolio_session');
            if (sessionData) {
                const data = JSON.parse(sessionData);
                
                // 24시간 이내 세션만 복구
                if (Date.now() - data.lastUpdated < 24 * 60 * 60 * 1000) {
                    this.sessionId = data.sessionId;
                    this.chatHistory = data.chatHistory || [];
                    this.currentContext = data.currentContext || {};
                    
                    console.log('기존 세션 복구:', this.sessionId, '메시지 수:', this.chatHistory.length);
                    return true;
                }
            }
        } catch (error) {
            console.error('세션 로드 실패:', error);
        }
        
        return false;
    }

    // 새 세션 시작
    startNewSession() {
        this.sessionId = this.generateSessionId();
        this.chatHistory = [];
        this.currentContext = {};
        this.saveSession();
        
        console.log('새 세션 시작:', this.sessionId);
    }

    // 세션 초기화
    clearSession() {
        localStorage.removeItem('portfolio_session');
        localStorage.removeItem('portfolio_session_id');
        this.startNewSession();
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
        if (!currentPage || currentPage === 'home') return;

        // 현재 페이지와 관련된 대화 기록
        const relevantMessages = this.chatHistory.filter(msg => {
            return msg.metadata.page === currentPage || 
                   msg.metadata.targetPage === currentPage ||
                   msg.metadata.relatedPages?.includes(currentPage);
        });

        // 플로팅 채팅창에 메시지 표시
        if (window.portfolioApp && relevantMessages.length > 0) {
            window.portfolioApp.loadChatHistory(relevantMessages);
        }

        console.log(`${currentPage} 페이지 관련 메시지 ${relevantMessages.length}개 동기화`);
    }
}

// 전역 세션 매니저 인스턴스
window.sessionManager = new SessionManager();
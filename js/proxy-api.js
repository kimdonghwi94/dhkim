class ProxyAPI {
    constructor() {
        // Proxy 서버 기본 엔드포인트 설정 (API v1)
        this.baseEndpoint = 'http://localhost:8000/api/v1'; // Proxy 서버 API v1 엔드포인트
        this.isConnected = false;
        this.agents = [];
        this.currentSessionId = null;
        this.init();
    }

    async init() {
        console.log('Proxy API 초기화 중...');
        
        // Health check로 연결 확인
        await this.checkHealth();
        
        // 연결 상태와 관계없이 항상 에이전트 목록 로드 시도
        // (연결 실패시 데모 데이터 반환)
        console.log('에이전트 목록 로드 시도... 연결 상태:', this.isConnected);
        await this.loadAgents();
    }

    // Health check API (GET /api/v1/health/)
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseEndpoint}/health/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            this.isConnected = response.ok;
            console.log('Proxy 서버 연결 상태:', this.isConnected ? '연결됨' : '연결 실패');
            
            if (response.ok) {
                // HealthResponse: { status, timestamp, version, uptime, agent_server, queue_status, system_info }
                const healthData = await response.json();
                console.log('Health check 응답:', healthData);
                
                // Agent 서버 상태도 확인
                if (healthData.agent_server && healthData.agent_server.status !== 'healthy') {
                    console.warn('Agent 서버 상태 경고:', healthData.agent_server);
                }
            }
            
            return this.isConnected;
        } catch (error) {
            console.warn('Proxy 서버 연결 실패:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    // 에이전트 리스트 조회 API (GET /api/v1/agent/list)
    async loadAgents() {
        try {
            const response = await fetch(`${this.baseEndpoint}/agent/list`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json(); // AgentListResponse
                this.agents = data.agents || [];
                console.log('에이전트 목록 로드됨:', data);
                
                // Proxy 상태 매니저에 업데이트 알림
                if (window.proxyStatusManager) {
                    window.proxyStatusManager.refreshStatus();
                }
                
                return data;
            } else {
                throw new Error(`에이전트 목록 로드 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('에이전트 목록 로드 오류:', error);
            
            // 연결 실패시 데모 데이터 반환 및 저장
            const demoData = this.getDemoAgentList();
            this.agents = demoData.agents; // 데모 데이터도 저장
            
            // Proxy 상태 매니저에 업데이트 알림
            if (window.proxyStatusManager) {
                window.proxyStatusManager.refreshStatus();
            }
            
            return demoData;
        }
    }

    // 사용자 입력 전송 API (POST /api/v1/agent/chat)
    async sendChatMessage(message, context = {}, userId = null) {
        try {
            // ChatRequest 형태로 데이터 구성
            const chatRequest = {
                message: message.substring(0, 10000), // max_length=10000
                context: {
                    page: context.currentPage || 'home',
                    session_id: this.currentSessionId || window.sessionManager?.sessionId,
                    timestamp: Date.now(),
                    user_agent: navigator.userAgent,
                    screen_size: `${window.innerWidth}x${window.innerHeight}`,
                    dark_mode: document.body.classList.contains('dark-mode'),
                    ...context
                },
                user_id: userId || this.generateUserId()
            };

            console.log('채팅 요청 전송:', chatRequest);

            const response = await fetch(`${this.baseEndpoint}/agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chatRequest)
            });

            if (!response.ok) {
                throw new Error(`채팅 API 오류: ${response.status} ${response.statusText}`);
            }

            // TaskResponse: { task_id: str, status: str, message: str }
            const taskResponse = await response.json();
            console.log('Task 응답:', taskResponse);

            return taskResponse;

        } catch (error) {
            console.error('채팅 메시지 전송 실패:', error);
            throw error;
        }
    }

    // Task 상태 조회 API (GET /api/v1/agent/chat/{task_id})
    async getTaskStatus(taskId) {
        try {
            const response = await fetch(`${this.baseEndpoint}/agent/chat/${taskId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Task 상태 조회 오류: ${response.status} ${response.statusText}`);
            }

            // TaskStatusResponse: { task_id, status, created_at, started_at, completed_at, result, error }
            const taskStatus = await response.json();
            console.log('Task 상태:', taskStatus);

            return taskStatus;

        } catch (error) {
            console.error('Task 상태 조회 실패:', error);
            throw error;
        }
    }

    // SSE 스트리밍 (GET /api/v1/agent/chat/stream/{task_id})
    async streamChatTask(taskId, onStream, onComplete, onError) {
        return new Promise((resolve, reject) => {
            const eventSource = new EventSource(`${this.baseEndpoint}/agent/chat/stream/${taskId}`);
            
            let fullResponse = '';
            let actions = [];
            let metadata = {};

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'status':
                            console.log('Task 상태:', data.status, data.message);
                            break;
                            
                        case 'content':
                            fullResponse += data.content;
                            if (onStream) {
                                onStream(data.content, fullResponse);
                            }
                            break;
                            
                        case 'action':
                            actions.push({
                                type: data.action,
                                params: data.params,
                                requires_approval: data.requires_approval !== false,
                                metadata: data.metadata
                            });
                            break;
                            
                        case 'metadata':
                            metadata = { ...metadata, ...data.metadata };
                            break;
                            
                        case 'complete':
                            eventSource.close();
                            const result = {
                                text: fullResponse,
                                actions: actions,
                                metadata: metadata,
                                task_id: taskId
                            };
                            
                            if (onComplete) {
                                onComplete(result);
                            }
                            resolve(result);
                            break;
                            
                        case 'error':
                            eventSource.close();
                            const error = new Error(data.message || '스트리밍 처리 중 오류 발생');
                            if (onError) {
                                onError(error);
                            }
                            reject(error);
                            break;
                    }
                } catch (parseError) {
                    console.error('스트림 데이터 파싱 오류:', parseError);
                }
            };

            eventSource.onerror = (error) => {
                eventSource.close();
                console.error('SSE 연결 오류:', error);
                const streamError = new Error('스트리밍 연결이 끊어졌습니다');
                if (onError) {
                    onError(streamError);
                }
                reject(streamError);
            };

            // 타임아웃 설정 (60초)
            setTimeout(() => {
                eventSource.close();
                const timeoutError = new Error('응답 시간 초과');
                if (onError) {
                    onError(timeoutError);
                }
                reject(timeoutError);
            }, 60000);
        });
    }

    // 통합 쿼리 처리 (기존 processQuery 대체)
    async processQuery(userQuery, context = {}) {
        try {
            // 1. 채팅 메시지 전송하여 task 생성
            const taskResponse = await this.sendChatMessage(userQuery, context);
            
            if (!taskResponse.task_id) {
                throw new Error('Task ID를 받지 못했습니다');
            }

            console.log(`Task ${taskResponse.task_id} 생성됨:`, taskResponse);

            // 2. SSE 스트리밍으로 결과 받기
            return await this.streamChatTask(
                taskResponse.task_id,
                context.onStream, // 스트리밍 콜백
                null, // onComplete는 Promise resolve로 처리
                null  // onError는 Promise reject로 처리
            );

        } catch (error) {
            console.error('쿼리 처리 실패:', error);
            
            // 폴백 처리 (기존 데모 방식)
            return this.fallbackProcessing(userQuery, context);
        }
    }

    // 스트리밍 쿼리 처리 (기존 processStreamingQuery 대체)
    async processStreamingQuery(userQuery, context = {}) {
        return this.processQuery(userQuery, context);
    }

    // 폴백 처리 (Proxy 서버 연결 실패시)
    async fallbackProcessing(userQuery, context = {}) {
        console.log('Proxy API 폴백 처리 사용:', userQuery);
        
        const lowerQuery = userQuery.toLowerCase();
        let response = '';
        let actions = [];

        // 기본적인 키워드 기반 처리
        if (lowerQuery.includes('포트폴리오')) {
            response = '포트폴리오 페이지로 이동합니다. 프로젝트와 작업 경험을 확인하실 수 있습니다.';
            actions.push({
                type: 'navigate',
                params: { page: 'portfolio' },
                requires_approval: true
            });
        } else if (lowerQuery.includes('이력서')) {
            response = '이력서 페이지로 이동합니다. 학력, 경력, 기본 정보를 확인하실 수 있습니다.';
            actions.push({
                type: 'navigate',
                params: { page: 'resume' },
                requires_approval: true
            });
        } else if (lowerQuery.includes('기술스택') || lowerQuery.includes('기술')) {
            response = '기술스택 페이지로 이동합니다. 보유한 기술과 역량을 확인하실 수 있습니다.';
            actions.push({
                type: 'navigate',
                params: { page: 'skills' },
                requires_approval: true
            });
        } else if (lowerQuery.includes('블로그') || lowerQuery.includes('글')) {
            response = '기술블로그 페이지로 이동합니다. 작성한 글들과 새 글 작성이 가능합니다.';
            actions.push({
                type: 'navigate',
                params: { page: 'blog' },
                requires_approval: true
            });
        } else if (lowerQuery.includes('안녕') || lowerQuery.includes('hello')) {
            response = '안녕하세요! 김동휘의 포트폴리오에 오신 것을 환영합니다. 포트폴리오, 이력서, 기술스택, 기술블로그 중 어떤 것을 보고 싶으신가요?';
        } else {
            response = `"${userQuery}"에 대한 답변을 준비하고 있습니다. 포트폴리오 관련 질문이시라면 구체적으로 "포트폴리오", "이력서", "기술스택", "기술블로그" 중 하나를 언급해주세요.`;
        }

        // 타이핑 효과 시뮬레이션
        if (context.onStream) {
            const words = response.split(' ');
            let currentText = '';
            
            for (const word of words) {
                currentText += word + ' ';
                context.onStream(word + ' ', currentText.trim());
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            }
        }

        return {
            text: response,
            actions: actions,
            metadata: { source: 'proxy_fallback', timestamp: Date.now() }
        };
    }

    // 데모 Agent 리스트 생성 (AgentListResponse 형태)
    getDemoAgentList() {
        const demoAgents = [
            {
                id: "portfolio-agent-001",
                name: "Portfolio Agent",
                description: "AI 포트폴리오 전문 에이전트 - 사용자 질문에 따라 포트폴리오 섹션으로 안내",
                status: "active",
                capabilities: [
                    "navigate_portfolio",
                    "analyze_user_intent", 
                    "content_recommendation",
                    "page_routing"
                ]
            },
            {
                id: "blog-management-agent-002", 
                name: "Blog Management Agent",
                description: "기술 블로그 관리 및 컨텐츠 생성 전문 에이전트",
                status: "active",
                capabilities: [
                    "create_blog_post",
                    "edit_content",
                    "search_articles",
                    "manage_categories",
                    "content_analysis"
                ]
            }
        ];

        console.log('데모 Agent 리스트 반환:', demoAgents);
        
        return {
            agents: demoAgents,
            total: demoAgents.length,
            error: null
        };
    }

    // 유틸리티 함수들
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 현재 상태 반환
    getStatus() {
        // 연결되지 않았고 agents가 비어있으면 데모 데이터 사용
        let agentsToReturn = this.agents;
        if (!this.isConnected && (!this.agents || this.agents.length === 0)) {
            const demoData = this.getDemoAgentList();
            agentsToReturn = demoData.agents;
        }

        return {
            connected: this.isConnected,
            agents: agentsToReturn,
            endpoint: this.baseEndpoint,
            sessionId: this.currentSessionId
        };
    }

    // 에이전트 목록 새로고침
    async refreshAgents() {
        return await this.loadAgents();
    }

    // Detailed Health check API (GET /api/v1/health/detailed)
    async getDetailedHealth() {
        try {
            const response = await fetch(`${this.baseEndpoint}/health/detailed`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const detailedHealth = await response.json();
                console.log('상세 Health check 응답:', detailedHealth);
                return detailedHealth;
            } else {
                throw new Error(`상세 Health check 실패: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('상세 Health check 오류:', error);
            throw error;
        }
    }

    // 연결 상태 재확인
    async reconnect() {
        await this.checkHealth();
        if (this.isConnected) {
            await this.loadAgents();
        }
        return this.isConnected;
    }
}

// 전역 Proxy API 인스턴스
window.proxyAPI = new ProxyAPI();
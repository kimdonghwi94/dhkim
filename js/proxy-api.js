class ProxyAPI {
    constructor() {
        // Proxy 서버 기본 엔드포인트 설정
        this.baseEndpoint = 'http://192.168.0.49:8000/api';
        this.isConnected = false;
        this.agents = [];
        this.currentSessionId = null;
        this.init();
    }

    async init() {
        // Health check로 연결 확인 후 에이전트 목록 로드
        const isConnected = await this.checkHealth();
        if (isConnected) {
            await this.loadAgents();
        }
    }

    // Health check API (GET /api/v1/health/)
    async checkHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃
            
            const response = await fetch(`${this.baseEndpoint}/health`, {
                method: 'GET',
                signal: controller.signal
                // Content-Type 헤더 제거로 OPTIONS 요청 방지
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // HealthResponse: { status, timestamp, version, uptime, agent_server, queue_status, system_info }
                const healthData = await response.json();

                // status 값으로 실제 연결 상태 판단
                this.isConnected = (healthData.status === 'healthy');
                
                // Agent 서버 상태도 확인
                if (healthData.agent_server && healthData.agent_server.status !== 'healthy') {
                    this.isConnected = false; // Agent 서버가 unhealthy면 전체를 연결 실패로 처리
                }
            } else {
                this.isConnected = false;
            }
            
            return this.isConnected;
        } catch (error) {
            this.isConnected = false;
            return false;
        }
    }

    // 에이전트 리스트 조회 API
    async loadAgents() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.baseEndpoint}/agent/list`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                this.agents = data.agents || [];
                
                // 상태 매니저 업데이트
                if (window.proxyStatusManager) {
                    window.proxyStatusManager.updateAgentList();
                }
                
                return data;
            } else {
                throw new Error(`에이전트 목록 로드 실패: ${response.status}`);
            }
        } catch (error) {
            this.agents = [];
            
            if (window.proxyStatusManager) {
                window.proxyStatusManager.updateAgentList();
            }
            
            return {
                agents: [],
                total: 0,
                error: '서버에 연결할 수 없습니다'
            };
        }
    }

    // 사용자 입력 전송 API
    async sendChatMessage(message, context = {}, userId = null) {
        try {
            const chatRequest = {
                message: message.substring(0, 10000),
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

            return await response.json();

        } catch (error) {
            throw error;
        }
    }

    // Task 상태 조회 API
    async getTaskStatus(taskId) {
        try {
            const response = await fetch(`${this.baseEndpoint}/agent/chat/${taskId}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Task 상태 조회 오류: ${response.status} ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            throw error;
        }
    }

    // SSE 스트리밍
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
                    console.warn('스트리밍 데이터 파싱 오류:', parseError);
                }
            };

            eventSource.onerror = (error) => {
                eventSource.close();
                const streamError = new Error('스트리밍 연결이 끊어졌습니다');
                if (onError) {
                    onError(streamError);
                }
                reject(streamError);
            };

            // 60초 타임아웃
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

    // 통합 쿼리 처리
    async processQuery(userQuery, context = {}) {
        try {
            const taskResponse = await this.sendChatMessage(userQuery, context);
            
            if (!taskResponse.task_id) {
                throw new Error('Task ID를 받지 못했습니다');
            }

            return await this.streamChatTask(
                taskResponse.task_id,
                context.onStream,
                null,
                null
            );

        } catch (error) {
            console.warn('서버 연결 실패, 폴백 모드:', error.message);
            return this.fallbackProcessing(userQuery, context);
        }
    }

    // 스트리밍 쿼리 처리 (하위 호환성)
    async processStreamingQuery(userQuery, context = {}) {
        return this.processQuery(userQuery, context);
    }

    // 폴백 처리 (Proxy 서버 연결 실패시)
    async fallbackProcessing(userQuery, context = {}) {
        
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
            response = '블로그 페이지로 이동합니다. 작성한 글들과 새 글 작성이 가능합니다.';
            actions.push({
                type: 'navigate',
                params: { page: 'blog' },
                requires_approval: true
            });
        } else if (lowerQuery.includes('안녕') || lowerQuery.includes('hello')) {
            response = '안녕하세요! 김동휘의 포트폴리오에 오신 것을 환영합니다. 포트폴리오, 이력서, 기술스택, 블로그 중 어떤 것을 보고 싶으신가요?';
        } else {
            response = `"${userQuery}"에 대한 답변을 준비하고 있습니다. 포트폴리오 관련 질문이시라면 구체적으로 "포트폴리오", "이력서", "기술스택", "블로그" 중 하나를 언급해주세요.`;
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


    // 유틸리티 함수들
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 현재 상태 반환
    getStatus() {
        return {
            connected: this.isConnected,
            agents: this.agents || [],
            endpoint: this.baseEndpoint,
            sessionId: this.currentSessionId
        };
    }

    // 에이전트 목록 새로고침
    async refreshAgents() {
        return await this.loadAgents();
    }


    // 연결 상태 재확인
    async reconnect() {
        return await this.init();
    }
}

// 전역 Proxy API 인스턴스
window.proxyAPI = new ProxyAPI();
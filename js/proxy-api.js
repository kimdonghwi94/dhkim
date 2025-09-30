class ProxyAPI {
    constructor() {
        // Proxy 서버 기본 엔드포인트 설정
        this.baseEndpoint = 'https://agent-gateway-1092310008847.asia-northeast3.run.app/api';
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
                // Health check successful

                // status 값으로 실제 연결 상태 판단
                this.isConnected = (healthData.status === 'healthy');

                // health check에서 받은 agent_server 데이터를 agents로 사용
                if (healthData.agent_server && Array.isArray(healthData.agent_server)) {
                    // agent_server 배열을 agents 형태로 변환
                    this.agents = healthData.agent_server.map((agentServer, index) => ({
                        id: `agent_${index}`,
                        name: `Agent Server ${index + 1}`,
                        description: 'AI Agent from Health Check',
                        status: agentServer.status,
                        capabilities: ['query_processing', 'response_generation'],
                        response_time_ms: agentServer.response_time_ms,
                        details: agentServer.details
                    }));

                    // Agent 서버 상태도 확인
                    for (const agentServer of healthData.agent_server) {
                        if (agentServer.status !== 'healthy') {
                            this.isConnected = false; // 하나라도 unhealthy면 전체를 연결 실패로 처리
                            break;
                        }
                    }
                } else {
                    this.agents = [];
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
            const streamUrl = `${this.baseEndpoint}/agent/chat/stream/${taskId}`;
            const eventSource = new EventSource(streamUrl);

            let fullResponse = '';
            let actions = [];
            let metadata = {};

            eventSource.onmessage = (event) => {
                try {
                    // [DONE] 메시지 처리
                    if (event.data === '[DONE]') {
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
                        return;
                    }

                    const data = JSON.parse(event.data);

                    // 서버에서 보내는 형식에 맞춰 처리
                    if (data.text !== undefined) {
                        // 텍스트 응답 처리 (메모리 이벤트 또는 일반 응답)
                        const textToAdd = data.event === 'ADD' ? data.text + '\n' : data.text;
                        fullResponse += textToAdd;
                        if (onStream) {
                            onStream(textToAdd, fullResponse);
                        }
                    } else if (data.content !== undefined) {
                        // content 형식 응답
                        fullResponse += data.content;
                        if (onStream) {
                            onStream(data.content, fullResponse);
                        }
                    } else if (data.type === 'final') {
                        // final 타입의 응답 처리

                        // 새로운 응답 형식 처리: data.result.result
                        if (data.result && data.result.result) {
                            fullResponse = data.result.result;
                            if (onStream) {
                                onStream(data.result.result, fullResponse);
                            }
                        }
                        // 기존 형식도 지원: data.result.response
                        else if (data.result && data.result.response) {
                            fullResponse = data.result.response;
                            if (onStream) {
                                onStream(data.result.response, fullResponse);
                            }
                        }
                    } else if (data.type) {
                        // 기존 type 기반 처리
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
                    }
                } catch (parseError) {
                    // Streaming data parsing error
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
        let taskResponse = null;
        try {
            taskResponse = await this.sendChatMessage(userQuery, context);

            if (!taskResponse.task_id) {
                throw new Error('Task ID를 받지 못했습니다');
            }

            const result = await this.streamChatTask(
                taskResponse.task_id,
                context.onStream,
                null,
                null
            );

            // 결과가 비어있으면 task status로 직접 조회
            if (!result.text || result.text.trim() === '') {
                try {
                    const taskStatus = await this.getTaskStatus(taskResponse.task_id);

                    // 새로운 응답 형식 처리
                    if (taskStatus && taskStatus.result) {
                        return {
                            text: taskStatus.result,
                            actions: [],
                            metadata: taskStatus.metadata || {},
                            task_id: taskResponse.task_id
                        };
                    }
                    // 기존 형식도 지원
                    else if (taskStatus && taskStatus.text) {
                        return taskStatus;
                    }
                } catch (statusError) {
                    // Task status check failed
                }
            }

            return result;

        } catch (error) {
            // 스트림이 실패했지만 task는 성공한 경우 직접 조회 시도
            if (taskResponse && taskResponse.task_id) {
                try {
                    const taskStatus = await this.getTaskStatus(taskResponse.task_id);

                    // 새로운 응답 형식 처리
                    if (taskStatus && taskStatus.result) {
                        return {
                            text: taskStatus.result,
                            actions: [],
                            metadata: taskStatus.metadata || {},
                            task_id: taskResponse.task_id
                        };
                    }
                    // 기존 형식도 지원
                    else if (taskStatus && taskStatus.text) {
                        return taskStatus;
                    }
                } catch (statusError) {
                    // Task status check also failed
                }
            }
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


    // 블로그 API 키 검증
    async verifyBlogApiKey(apiKey) {
        try {
            const response = await fetch(`${this.baseEndpoint}/blog/verify-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ api_key: apiKey })
            });

            if (!response.ok) {
                throw new Error(`API 키 검증 실패: ${response.status}`);
            }

            const result = await response.json();
            return result.valid === true;

        } catch (error) {
            return false;
        }
    }

    // 블로그 게시글 비밀번호 검증
    async verifyPostPassword(postId, password) {
        try {
            const response = await fetch(`${this.baseEndpoint}/blog/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    post_id: postId,
                    password: password
                })
            });

            if (!response.ok) {
                throw new Error(`비밀번호 검증 실패: ${response.status}`);
            }

            const result = await response.json();
            return result.valid === true;

        } catch (error) {
            return false;
        }
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
class MCPAgent {
    constructor() {
        this.apiEndpoint = 'http://localhost:8080/api/mcp'; // MCP API 엔드포인트
        this.isConnected = false;
        this.capabilities = new Set();
        this.init();
    }

    async init() {
        console.log('MCP Agent 초기화 중...');
        
        // MCP 서버 연결 확인
        await this.checkConnection();
        
        // 사용 가능한 도구들 조회
        if (this.isConnected) {
            await this.loadCapabilities();
        }
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.apiEndpoint}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            this.isConnected = response.ok;
            console.log('MCP 연결 상태:', this.isConnected ? '연결됨' : '연결 실패');
            
            return this.isConnected;
        } catch (error) {
            console.warn('MCP 서버 연결 실패:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    async loadCapabilities() {
        try {
            const response = await fetch(`${this.apiEndpoint}/tools`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const tools = await response.json();
                this.capabilities = new Set(tools.map(tool => tool.name));
                console.log('MCP 도구들 로드됨:', Array.from(this.capabilities));
            }
        } catch (error) {
            console.error('MCP 도구 로드 실패:', error);
        }
    }

    // 메인 AI 쿼리 처리
    async processQuery(userQuery, context = {}) {
        if (!this.isConnected) {
            console.warn('MCP 서버에 연결되지 않음, 폴백 처리 사용');
            return this.fallbackProcessing(userQuery, context);
        }

        try {
            // 세션 컨텍스트 준비
            const mcpContext = this.prepareMCPContext(userQuery, context);
            
            console.log('MCP 쿼리 전송:', { userQuery, context: mcpContext });

            // MCP 서버로 쿼리 전송
            const response = await fetch(`${this.apiEndpoint}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: userQuery,
                    context: mcpContext,
                    session_id: window.sessionManager?.sessionId,
                    tools: Array.from(this.capabilities)
                })
            });

            if (!response.ok) {
                throw new Error(`MCP API 오류: ${response.status}`);
            }

            const result = await response.json();
            console.log('MCP 응답:', result);

            // 응답 처리 및 변환
            return this.processMCPResponse(result);

        } catch (error) {
            console.error('MCP 쿼리 처리 실패:', error);
            return this.fallbackProcessing(userQuery, context);
        }
    }

    // SSE를 통한 스트리밍 쿼리 처리
    async processStreamingQuery(userQuery, context = {}) {
        if (!this.isConnected) {
            return this.fallbackStreamingProcessing(userQuery, context);
        }

        const mcpContext = this.prepareMCPContext(userQuery, context);
        
        return new Promise((resolve, reject) => {
            const eventSource = new EventSource(
                `${this.apiEndpoint}/stream?${new URLSearchParams({
                    query: userQuery,
                    context: JSON.stringify(mcpContext),
                    session_id: window.sessionManager?.sessionId || ''
                })}`
            );

            let fullResponse = '';
            let actions = [];

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'content':
                            fullResponse += data.content;
                            // 스트리밍 콜백 호출
                            if (context.onStream) {
                                context.onStream(data.content, fullResponse);
                            }
                            break;
                            
                        case 'action':
                            actions.push({
                                type: data.action,
                                params: data.params,
                                metadata: data.metadata
                            });
                            break;
                            
                        case 'tool_result':
                            console.log('MCP 도구 실행 결과:', data.result);
                            break;
                            
                        case 'complete':
                            eventSource.close();
                            resolve({
                                response: fullResponse,
                                actions: actions,
                                metadata: data.metadata
                            });
                            break;
                            
                        case 'error':
                            eventSource.close();
                            reject(new Error(data.message));
                            break;
                    }
                } catch (parseError) {
                    console.error('MCP 스트림 파싱 오류:', parseError);
                }
            };

            eventSource.onerror = (error) => {
                eventSource.close();
                console.error('MCP 스트림 오류:', error);
                reject(error);
            };

            // 타임아웃 설정
            setTimeout(() => {
                eventSource.close();
                reject(new Error('MCP 응답 시간 초과'));
            }, 30000);
        });
    }

    prepareMCPContext(userQuery, context) {
        // 세션 매니저에서 컨텍스트 가져오기
        const sessionContext = window.sessionManager?.prepareMCPContext() || {};
        
        return {
            ...sessionContext,
            user_query: userQuery,
            current_page: context.currentPage || 'home',
            available_pages: ['portfolio', 'resume', 'skills', 'blog'],
            user_intent: this.analyzeUserIntent(userQuery),
            context_metadata: {
                timestamp: Date.now(),
                user_agent: navigator.userAgent,
                screen_size: `${window.innerWidth}x${window.innerHeight}`,
                dark_mode: document.body.classList.contains('dark-mode')
            },
            ...context
        };
    }

    analyzeUserIntent(query) {
        const lowerQuery = query.toLowerCase();
        
        // 의도 분석 키워드 매핑
        const intentMap = {
            navigation: ['이동', '보여줘', '보여주세요', '가고싶어', '페이지', 'go to', 'show me'],
            information: ['알려줘', '설명', '무엇', '어떤', '정보', 'tell me', 'what is'],
            action: ['다운로드', '저장', '공유', '복사', 'download', 'save', 'share'],
            greeting: ['안녕', '반가워', '처음', 'hello', 'hi', 'hey']
        };

        for (const [intent, keywords] of Object.entries(intentMap)) {
            if (keywords.some(keyword => lowerQuery.includes(keyword))) {
                return intent;
            }
        }

        return 'general';
    }

    processMCPResponse(mcpResult) {
        // MCP 응답을 UI에서 사용할 수 있는 형태로 변환
        const response = {
            text: mcpResult.response || mcpResult.content || '',
            actions: [],
            metadata: mcpResult.metadata || {}
        };

        // 액션 처리
        if (mcpResult.actions && Array.isArray(mcpResult.actions)) {
            response.actions = mcpResult.actions.map(action => ({
                type: action.type,
                params: action.params,
                metadata: action.metadata,
                requires_approval: action.requires_approval !== false // 기본적으로 승인 필요
            }));
        }

        // 도구 실행 결과 처리
        if (mcpResult.tool_results) {
            response.toolResults = mcpResult.tool_results;
        }

        return response;
    }

    // MCP 연결 실패시 폴백 처리
    fallbackProcessing(userQuery, context) {
        console.log('MCP 폴백 처리 사용:', userQuery);
        
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

        return Promise.resolve({
            text: response,
            actions: actions,
            metadata: { source: 'fallback', timestamp: Date.now() }
        });
    }

    async fallbackStreamingProcessing(userQuery, context) {
        // 폴백 스트리밍 시뮬레이션
        const result = await this.fallbackProcessing(userQuery, context);
        
        // 타이핑 효과 시뮬레이션
        if (context.onStream) {
            const words = result.text.split(' ');
            let currentText = '';
            
            for (const word of words) {
                currentText += word + ' ';
                context.onStream(word + ' ', currentText.trim());
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            }
        }
        
        return result;
    }

    // MCP 서버 상태 확인
    getStatus() {
        return {
            connected: this.isConnected,
            capabilities: Array.from(this.capabilities),
            endpoint: this.apiEndpoint
        };
    }
}

// 전역 MCP Agent 인스턴스
window.mcpAgent = new MCPAgent();
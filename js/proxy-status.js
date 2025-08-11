class ProxyStatusManager {
    constructor() {
        this.isVisible = false;
        this.servers = new Map();
        this.tools = new Map();
        this.refreshInterval = null;
        this.init();
    }

    init() {
        console.log('MCP Status Manager 초기화 중...');
        
        // 주기적 상태 업데이트 시작
        this.startPeriodicRefresh();
        
        // 초기 상태 로드
        this.refreshStatus();
        
        // 클릭 외부 영역 감지
        document.addEventListener('click', (e) => {
            const proxyStatus = document.getElementById('proxy-status');
            const proxyPanel = document.getElementById('proxy-panel');
            
            // Proxy 패널이나 상태 버튼을 클릭한 경우 무시
            if (proxyStatus && proxyPanel && !proxyStatus.contains(e.target) && !proxyPanel.contains(e.target)) {
                this.hideProxyPanel();
            }
        });
        
        // Proxy 패널 내부 클릭 시 이벤트 전파 중단
        setTimeout(() => {
            const proxyPanel = document.getElementById('proxy-panel');
            if (proxyPanel) {
                proxyPanel.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }, 100);
    }

    async refreshStatus() {
        console.log('Proxy API 상태 새로고침 중...');
        
        // Agent 리스트를 먼저 업데이트한 후 상태 표시
        await this.updateAgentList();
        await this.updateProxyStatus();
        
        this.updateUI();
        
        // 활성화된 서버들의 연결 상태 재확인 (데모 모드에서는 건너뜀)
        if (window.proxyAPI && window.proxyAPI.isConnected) {
            await this.checkActiveServers();
        }
    }

    async updateProxyStatus() {
        const statusLight = document.getElementById('status-light');
        const statusText = document.getElementById('status-text');
        
        if (!statusLight || !statusText) return;

        try {
            // Proxy API 연결 확인
            let isConnected = false;
            let status = { agents: [] };
            
            if (window.proxyAPI) {
                isConnected = await window.proxyAPI.checkHealth();
                status = window.proxyAPI.getStatus();
            }
            
            // 상태 표시 업데이트 (색상 없음)
            statusLight.className = 'status-light';
            
            if (isConnected) {
                const agentCount = status.agents ? status.agents.length : 0;
                statusText.textContent = `연결 Agent (${agentCount})`;
            } else {
                // 연결 실패시 데모 모드 표시 - 데모 Agent 개수 포함
                const demoAgentCount = this.servers.size;
                console.log(`데모 모드: Agent 개수 = ${demoAgentCount}, servers 맵:`, this.servers);
                statusText.textContent = `연결 Agent (${demoAgentCount})`;
                // 메인 앱도 데모 모드로 설정
                if (window.portfolioApp) {
                    window.portfolioApp.demoMode = true;
                }
            }
            
        } catch (error) {
            console.error('Proxy API 상태 업데이트 실패:', error);
            statusLight.className = 'status-light';
            // 에러 발생시도 데모 Agent 개수 표시
            const demoAgentCount = this.servers.size;
            statusText.textContent = `연결 Agent (${demoAgentCount})`;
            // 에러 발생시도 데모 모드로 설정
            if (window.portfolioApp) {
                window.portfolioApp.demoMode = true;
            }
        }
    }


    async updateAgentList() {
        // Agent → MCP 서버 → 도구 계층 구조로 변환
        this.servers.clear();
        
        if (window.proxyAPI) {
            // Proxy API 상태 가져오기 (연결 상태와 관계없이)
            const status = window.proxyAPI.getStatus();
            console.log('Proxy API 상태:', status);
            
            if (status.agents && status.agents.length > 0) {
                console.log('Agent 데이터 처리 중:', status.agents);
                
                status.agents.forEach(agent => {
                    // AgentInfo 구조: { id, name, description, status, capabilities }
                    console.log(`Agent 추가: ${agent.name} (${agent.id})`);
                    
                    this.servers.set(agent.id, {
                        id: agent.id,
                        name: agent.name,
                        url: agent.description || 'AI Agent',
                        status: agent.status === 'active' ? 'connected' : 'disconnected', 
                        enabled: agent.status === 'active',
                        type: window.proxyAPI.isConnected ? 'agent' : 'demo-agent',
                        expanded: false,
                        // MCP 서버들
                        mcpServers: [
                            {
                                id: `${agent.id}-mcp`,
                                name: `${agent.name} MCP Server`,
                                url: window.proxyAPI.isConnected ? 'MCP 연결됨' : 'MCP 연결됨 (Demo)',
                                status: 'connected',
                                expanded: false,
                                tools: agent.capabilities ? agent.capabilities.map(cap => ({ name: cap })) : [
                                    { name: 'query_processing' },
                                    { name: 'response_generation' }
                                ]
                            }
                        ]
                    });
                });
            } else {
                console.log('Agent 데이터가 없어서 기본 데모 데이터 사용');
                this.createFallbackDemoData();
            }
        } else {
            console.log('ProxyAPI가 없어서 기본 데모 데이터 사용');  
            this.createFallbackDemoData();
        }
        
        // 저장된 상태 복원
        this.loadServerStates();
        
        console.log('최종 servers 맵:', this.servers);
    }

    // 폴백용 데모 데이터 생성
    createFallbackDemoData() {
        console.log('폴백 데모 데이터 생성 중...');
        
        // 데모 모드: 현실적인 Agent → MCP 서버 → 도구 구조
        this.servers.set('portfolio-agent', {
            id: 'portfolio-agent',
            name: 'Portfolio Agent',
            url: 'AI 포트폴리오 전문 에이전트',
            status: 'connected',
            enabled: true,
            type: 'demo-agent',
            expanded: false,
            mcpServers: [
                {
                    id: 'navigation-mcp',
                    name: 'Navigation MCP Server',
                    url: 'localhost:3001 (Demo)',
                    status: 'connected',
                    expanded: false,
                    tools: [
                        { name: 'navigate_page' },
                        { name: 'scroll_to_section' },
                        { name: 'get_page_info' }
                    ]
                },
                {
                    id: 'content-mcp',
                    name: 'Content Analysis MCP',
                    url: 'localhost:3002 (Demo)', 
                    status: 'connected',
                    expanded: false,
                    tools: [
                        { name: 'analyze_query' },
                        { name: 'generate_response' },
                        { name: 'extract_intent' }
                    ]
                }
            ]
        });
        
        this.servers.set('blog-agent', {
            id: 'blog-agent',
            name: 'Blog Management Agent',
            url: 'AI 블로그 관리 전문 에이전트',
            status: 'connected',
            enabled: true,
            type: 'demo-agent',
            expanded: false,
            mcpServers: [
                {
                    id: 'blog-mcp',
                    name: 'Blog MCP Server',
                    url: 'localhost:3003 (Demo)',
                    status: 'connected',
                    expanded: false,
                    tools: [
                        { name: 'create_post' },
                        { name: 'edit_post' },
                        { name: 'search_posts' },
                        { name: 'manage_categories' }
                    ]
                }
            ]
        });
        
        console.log('폴백 데모 데이터 생성 완료:', this.servers);
    }

    
    // 활성화된 서버들의 연결 상태 자동 확인
    async checkActiveServers() {
        console.log('활성화된 서버들의 연결 상태 확인 중...');
        
        for (const [serverId, server] of this.servers.entries()) {
            if (server.enabled) {
                console.log(`서버 ${server.name} 연결 상태 확인 중...`);
                
                // 연결 중 상태로 변경
                server.status = 'connecting';
                this.renderServerList();
                
                try {
                    // API 호출
                    const result = await this.connectToServer(serverId);
                    
                    if (result.success) {
                        server.status = 'connected';
                        server.tools = result.tools || [];
                        console.log(`서버 ${server.name} 연결 확인됨`);
                    } else {
                        server.status = 'error';
                        server.tools = [];
                        console.log(`서버 ${server.name} 연결 실패:`, result.error);
                    }
                } catch (error) {
                    server.status = 'error';
                    server.tools = [];
                    console.error(`서버 ${server.name} 연결 오류:`, error);
                }
                
                // UI 업데이트
                this.renderServerList();
                this.saveServerStates();
            }
        }
    }


    updateUI() {
        this.renderServerList();
    }

    getServerStatusClass(server) {
        if (!server.enabled) {
            return 'off'; // 완전히 숨김
        }
        
        switch (server.status) {
            case 'connecting':
                return 'connecting orange';
            case 'connected':
                return 'connected green';
            case 'error':
                return 'error red';
            default:
                return 'off';
        }
    }

    renderServerList() {
        const serversContainer = document.getElementById('proxy-servers');
        if (!serversContainer) return;

        const agentsArray = Array.from(this.servers.values());
        
        serversContainer.innerHTML = `
            <h4>
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13 3L17 7L2 7L2 9L17 9L13 13L15 15L21 9Z"/>
                </svg>
                연결된 Agent (${agentsArray.length})
            </h4>
            ${agentsArray.length === 0 ? 
                '<div class="empty-state">연결된 Agent가 없습니다</div>' :
                agentsArray.map(agent => this.renderAgent(agent)).join('')
            }
        `;
    }

    renderAgent(agent) {
        return `
            <div class="agent-item ${agent.expanded ? 'expanded' : ''}">
                <div class="agent-header" onclick="toggleAgentExpand('${agent.id}', event)">
                    <div class="agent-main-info">
                        <div class="agent-status ${this.getAgentStatusClass(agent)}"></div>
                        <div class="agent-info">
                            <div class="agent-name"> ${agent.name}</div>
                            <div class="agent-description">${agent.url}</div>
                        </div>
                        <svg class="agent-expand-arrow" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z"/>
                        </svg>
                    </div>
                    <div class="agent-toggle" onclick="event.stopPropagation(); toggleAgent('${agent.id}')">
                        <div class="toggle-switch ${agent.enabled ? 'on' : 'off'}">
                            <div class="toggle-knob"></div>
                        </div>
                    </div>
                </div>
                <div class="agent-mcp-servers">
                    ${!agent.enabled ? '' : 
                        !agent.mcpServers || agent.mcpServers.length === 0 ? 
                            '<div class="empty-state">연결된 MCP 서버가 없습니다</div>' :
                            agent.mcpServers.map(mcpServer => this.renderMCPServer(mcpServer, agent.id)).join('')
                    }
                </div>
            </div>
        `;
    }

    renderMCPServer(mcpServer, agentId) {
        return `
            <div class="mcp-server-item ${mcpServer.expanded ? 'expanded' : ''}">
                <div class="mcp-server-header" onclick="toggleMCPServerExpand('${agentId}', '${mcpServer.id}', event)">
                    <div class="mcp-server-main-info">
                        <div class="mcp-server-status ${this.getMCPServerStatusClass(mcpServer)}"></div>
                        <div class="mcp-server-info">
                            <div class="mcp-server-name">${mcpServer.name}</div>
                        </div>
                        <svg class="mcp-server-expand-arrow" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z"/>
                        </svg>
                    </div>
                </div>
                <div class="mcp-server-tools">
                    ${!mcpServer.tools || mcpServer.tools.length === 0 ? 
                        '<div class="empty-state">사용 가능한 도구가 없습니다</div>' :
                        `<div class="tools-grid">
                            ${mcpServer.tools.map(tool => `
                                <div class="tool-tag" onclick="testTool('${tool.name}', '${mcpServer.id}')">
                                    ${tool.name}
                                </div>
                            `).join('')}
                        </div>`
                    }
                </div>
            </div>
        `;
    }

    getAgentStatusClass(agent) {
        if (!agent.enabled) {
            return 'off';
        }
        
        switch (agent.status) {
            case 'connecting':
                return 'connecting orange';
            case 'connected':
                return 'connected green';
            case 'error':
                return 'error red';
            default:
                return 'off';
        }
    }

    getMCPServerStatusClass(mcpServer) {
        switch (mcpServer.status) {
            case 'connecting':
                return 'connecting orange';
            case 'connected':
                return 'connected green';
            case 'error':
                return 'error red';
            default:
                return 'off';
        }
    }

    // Agent 확장/축소
    toggleAgentExpand(agentId) {
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        agent.expanded = !agent.expanded;
        
        // UI 업데이트
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
        
        console.log(`Agent ${agentId} ${agent.expanded ? '펼침' : '접음'}`);
    }

    // MCP 서버 확장/축소
    toggleMCPServerExpand(agentId, mcpServerId) {
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        if (!agent.mcpServers) return;
        
        const mcpServer = agent.mcpServers.find(server => server.id === mcpServerId);
        if (!mcpServer) return;
        
        mcpServer.expanded = !mcpServer.expanded;
        
        // UI 업데이트
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
        
        console.log(`MCP 서버 ${mcpServerId} ${mcpServer.expanded ? '펼침' : '접음'}`);
    }

    // Agent 활성화/비활성화
    toggleAgent(agentId) {
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        
        if (agent.type === 'demo-agent') {
            // 데모 모드에서는 토글만 시뮬레이션
            agent.enabled = !agent.enabled;
            agent.status = agent.enabled ? 'connected' : 'disconnected';
            
            console.log(`데모 Agent ${agentId} ${agent.enabled ? '활성화' : '비활성화'}`);
        } else {
            // 실제 Agent 토글 로직 (추후 구현)
            console.log(`실제 Agent ${agentId} 토글 요청`);
        }
        
        // UI 업데이트
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
    }

    // 기존 함수 (하위 호환성)
    toggleServerTools(serverId) {
        this.toggleAgentExpand(serverId);
    }

    startPeriodicRefresh() {
        // 주기적 새로고침 비활성화 - 수동으로만 새로고침
        // this.refreshInterval = setInterval(() => {
        //     this.refreshStatus();
        // }, 30000);
    }

    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    toggleProxyPanel() {
        const proxyStatus = document.getElementById('proxy-status');
        const proxyPanel = document.getElementById('proxy-panel');
        
        if (!proxyStatus || !proxyPanel) return;

        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            proxyStatus.classList.add('active');
            proxyPanel.classList.add('active');
            
            // 패널 열릴 때 상태 새로고침
            this.refreshStatus();
        } else {
            proxyStatus.classList.remove('active');
            proxyPanel.classList.remove('active');
        }
    }

    hideProxyPanel() {
        if (!this.isVisible) return;
        
        const proxyStatus = document.getElementById('proxy-status');
        const proxyPanel = document.getElementById('proxy-panel');
        
        if (proxyStatus && proxyPanel) {
            proxyStatus.classList.remove('active');
            proxyPanel.classList.remove('active');
            this.isVisible = false;
        }
    }

    // 서버별 세부 정보 가져오기
    async getServerDetails(serverId) {
        if (!this.servers.has(serverId)) return null;
        
        const server = this.servers.get(serverId);
        
        try {
            if (server.type === 'demo') {
                return {
                    ...server,
                    uptime: '00:00:00',
                    version: 'Demo v1.0.0',
                    lastPing: Date.now()
                };
            }
            
            // 실제 서버 정보 조회
            const response = await fetch(`${server.url}/info`);
            if (response.ok) {
                const info = await response.json();
                return { ...server, ...info };
            }
        } catch (error) {
            console.error(`서버 ${serverId} 정보 조회 실패:`, error);
        }
        
        return server;
    }

    // 서버 토글
    async toggleServer(serverId) {
        if (!this.servers.has(serverId)) return;
        
        const server = this.servers.get(serverId);
        
        if (server.enabled) {
            // OFF: 서버 비활성화
            server.enabled = false;
            server.status = 'disconnected';
            server.expanded = false;
            server.tools = [];
            console.log(`서버 ${server.name} 비활성화됨`);
        } else {
            // ON: 서버 활성화 시도
            server.enabled = true;
            server.status = 'connecting';
            console.log(`서버 ${server.name} 연결 시도 중...`);
            
            // UI 즉시 업데이트 (주황색 표시)
            this.renderServerList();
            
            try {
                // API 호출
                const result = await this.connectToServer(serverId);
                
                if (result.success) {
                    server.status = 'connected';
                    server.tools = result.tools || [];
                    console.log(`서버 ${server.name} 연결 성공`);
                } else {
                    server.status = 'error';
                    server.tools = [];
                    console.log(`서버 ${server.name} 연결 실패:`, result.error);
                }
            } catch (error) {
                server.status = 'error';
                server.tools = [];
                console.error(`서버 ${server.name} 연결 오류:`, error);
            }
        }
        
        // UI 업데이트
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
    }
    
    // 서버 연결 API 호출
    async connectToServer(serverId) {
        const server = this.servers.get(serverId);
        
        if (server.type === 'demo') {
            // 데모 모드: 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5초 대기
            
            // 90% 확률로 성공, 10% 확률로 실패 (테스트용)
            const isSuccess = Math.random() > 0.1;
            
            if (isSuccess) {
                return {
                    success: true,
                    tools: [
                        { name: 'navigate' },
                        { name: 'intent_analysis' },
                        { name: 'content_generation' },
                        { name: 'session_management' }
                    ]
                };
            } else {
                return {
                    success: false,
                    error: 'Demo connection failed (random test)'
                };
            }
        } else {
            // 실제 API 호출
            try {
                const response = await fetch(`${server.url}/connect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        server_id: serverId
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                return {
                    success: data.status === 'success',
                    tools: data.tools || [],
                    error: data.error
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }
    
    // 서버 상태 저장
    saveServerStates() {
        const serverStates = {};
        for (const [serverId, server] of this.servers.entries()) {
            serverStates[serverId] = {
                enabled: server.enabled,
                expanded: server.expanded,
                status: server.status,
                tools: server.tools
            };
        }
        localStorage.setItem('mcp-server-states', JSON.stringify(serverStates));
    }
    
    // 서버 상태 복원
    loadServerStates() {
        try {
            const saved = localStorage.getItem('mcp-server-states');
            if (saved) {
                const serverStates = JSON.parse(saved);
                for (const [serverId, server] of this.servers.entries()) {
                    if (serverStates[serverId]) {
                        const savedState = serverStates[serverId];
                        if (savedState.enabled !== undefined) {
                            server.enabled = savedState.enabled;
                        }
                        if (savedState.expanded !== undefined) {
                            server.expanded = savedState.expanded;
                        }
                        if (savedState.status !== undefined) {
                            server.status = savedState.status;
                        }
                        if (savedState.tools !== undefined) {
                            server.tools = savedState.tools;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('서버 상태 복원 실패:', error);
        }
    }

    // 도구 실행 테스트
    async testTool(toolName) {
        try {
            console.log(`도구 ${toolName} 테스트 중...`);
            
            if (window.proxyAPI && window.proxyAPI.isConnected) {
                // Proxy API를 통한 도구 테스트
                const result = await window.proxyAPI.processQuery(`test ${toolName}`, {
                    test_mode: true
                });
                
                return result && result.metadata && result.metadata.success;
            } else {
                // 연결되지 않은 경우 false 반환
                return false;
            }
        } catch (error) {
            console.error(`도구 ${toolName} 테스트 실패:`, error);
            return false;
        }
    }
}

// 전역 함수들
function toggleProxyPanel() {
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleProxyPanel();
    }
}

async function refreshProxyStatus() {
    if (window.proxyStatusManager) {
        // 새로고침 버튼 애니메이션 시작
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.style.transform = 'rotate(360deg)';
            refreshBtn.style.pointerEvents = 'none'; // 클릭 방지
        }
        
        try {
            await window.proxyStatusManager.refreshStatus();
        } finally {
            // 애니메이션 종료
            if (refreshBtn) {
                setTimeout(() => {
                    refreshBtn.style.transform = '';
                    refreshBtn.style.pointerEvents = '';
                }, 500);
            }
        }
    }
}

// Agent 확장/축소
function toggleAgentExpand(agentId, event) {
    if (event) {
        event.stopPropagation();
    }
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleAgentExpand(agentId);
    }
}

// Agent 활성화/비활성화 
function toggleAgent(agentId) {
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleAgent(agentId);
    }
}

// MCP 서버 확장/축소
function toggleMCPServerExpand(agentId, mcpServerId, event) {
    if (event) {
        event.stopPropagation();
    }
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleMCPServerExpand(agentId, mcpServerId);
    }
}

// 기존 함수들 (하위 호환성)
function toggleServerTools(serverId, event) {
    toggleAgentExpand(serverId, event);
}

function toggleServer(serverId) {
    toggleAgent(serverId);
}

async function testTool(toolName, serverId) {
    if (window.proxyStatusManager) {
        console.log(`도구 테스트: ${toolName} (서버: ${serverId})`);
        
        const success = await window.proxyStatusManager.testTool(toolName);
        
        // 테스트 결과 피드백
        const message = success ? 
            `✅ ${toolName} 도구가 정상적으로 작동합니다` : 
            `❌ ${toolName} 도구 테스트에 실패했습니다`;
            
        // 임시 알림 표시
        if (window.portfolioApp) {
            window.portfolioApp.showTemporaryMessage(message, 'ai-message');
        }
    }
}

// 전역 Proxy Status Manager 인스턴스
document.addEventListener('DOMContentLoaded', () => {
    window.proxyStatusManager = new ProxyStatusManager();
});
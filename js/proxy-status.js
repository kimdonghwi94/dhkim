class ProxyStatusManager {
    constructor() {
        this.isVisible = false;
        this.servers = new Map();
        this.tools = new Map();
        this.refreshInterval = null;
        this.isConnecting = false; // 연결 시도 중인지 추적
        this.init();
    }

    init() {
        
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
        // 이미 연결 시도 중이면 무시
        if (this.isConnecting) {
            return;
        }
        
        this.isConnecting = true;
        
        try {
            // 연결 확인 중 표시
            const statusLight = document.getElementById('status-light');
            const statusText = document.getElementById('status-text');
            
            if (statusLight && statusText) {
                statusLight.className = 'status-light connecting orange';
                statusText.textContent = 'Agent Connect (연결 확인 중...)';
            }
            
            if (window.proxyAPI) {
                // 1. Health check 수행
                const isConnected = await window.proxyAPI.checkHealth();
                
                if (isConnected) {
                    // 2. 연결 성공시에만 Agent 리스트 로드
                    await window.proxyAPI.loadAgents();
                }
                
                // 3. UI 업데이트 (한 번만)
                await this.updateAgentList();
                await this.updateProxyStatus(true); // 이미 health check 했으므로 skip
                this.updateUI();
            }
        } catch (error) {
            // 에러 발생시 UI만 업데이트
            await this.updateAgentList();
            await this.updateProxyStatus(true);
            this.updateUI();
        } finally {
            this.isConnecting = false;
        }
    }

    async updateProxyStatus(skipHealthCheck = false) {
        const statusLight = document.getElementById('status-light');
        const statusText = document.getElementById('status-text');
        
        if (!statusLight || !statusText) return;

        try {
            let isConnected = false;
            let status = { agents: [] };
            
            if (window.proxyAPI) {
                if (skipHealthCheck) {
                    // Health check를 건너뛰고 현재 상태만 확인
                    isConnected = window.proxyAPI.isConnected;
                    status = window.proxyAPI.getStatus();
                } else {
                    // 연결 확인 중 상태 표시
                    statusLight.className = 'status-light connecting orange';
                    statusText.textContent = 'Agent Connect (연결 확인 중...)';
                    
                    try {
                        // 타임아웃을 추가한 health check 수행
                        const healthCheckPromise = window.proxyAPI.checkHealth();
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Connection timeout')), 10000)
                        );
                        
                        const healthCheck = await Promise.race([healthCheckPromise, timeoutPromise]);
                        isConnected = healthCheck;
                        status = window.proxyAPI.getStatus();
                        
                    } catch (healthError) {
                        console.log('Health check failed:', healthError.message);
                        isConnected = false;
                        status = { agents: [] };
                    }
                }
            }
            
            // 연결 상태에 따른 상태 표시 업데이트
            if (isConnected) {
                statusLight.className = 'status-light connected green';
                const agentCount = status.agents ? status.agents.length : 0;
                statusText.textContent = `Agent Connect (${agentCount})`;
            } else {
                // 연결 실패시 빨간색 표시
                statusLight.className = 'status-light error red';
                statusText.textContent = `Agent Connect (연결 실패)`;
            }
            
        } catch (error) {
            // 에러 발생시도 빨간색 표시
            statusLight.className = 'status-light error red';
            statusText.textContent = `Agent Connect (연결 실패)`;
        }
    }


    async updateAgentList() {
        // Agent → MCP 서버 → 도구 계층 구조로 변환
        this.servers.clear();
        
        if (window.proxyAPI) {
            // Proxy API 상태 가져오기 (연결 상태와 관계없이)
            const status = window.proxyAPI.getStatus();
            
            if (status.agents && status.agents.length > 0) {
                
                status.agents.forEach(agent => {
                    // AgentInfo 구조: { id, name, description, status, capabilities }
                    
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
                // Agent 데이터가 없으면 빈 상태로 유지
            }
        } else {
            // ProxyAPI가 없으면 빈 상태로 유지
        }
        
        // 저장된 상태 복원
        this.loadServerStates();
        
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
        
        // 프록시 서버 상태 확인
        const isProxyHealthy = window.proxyAPI && window.proxyAPI.isConnected;
        const statusMessage = this.getStatusMessage(agentsArray.length, isProxyHealthy);
        
        serversContainer.innerHTML = `
            <h4>
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13 3L17 7L2 7L2 9L17 9L13 13L15 15L21 9Z"/>
                </svg>
                ${statusMessage.title}
            </h4>
            ${agentsArray.length === 0 ? 
                `<div class="empty-state">${statusMessage.message}</div>` :
                agentsArray.map(agent => this.renderAgent(agent)).join('')
            }
        `;
        
        // 콘텐츠에 따라 패널 크기 동적 조절
        this.adjustPanelSize(agentsArray);
    }

    getStatusMessage(agentCount, isProxyHealthy) {
        if (!isProxyHealthy) {
            return {
                title: '연결 실패',
                message: '서버가 연결되지 않았거나 응답하지 않습니다'
            };
        }
        
        if (agentCount === 0) {
            return {
                title: '연결됨 (Agent 없음)',
                message: '서버는 정상이지만 사용 가능한 AI 에이전트가 없습니다'
            };
        }
        
        return {
            title: `연결된 Agent (${agentCount})`,
            message: ''
        };
    }

    adjustPanelSize(agentsArray) {
        const proxyPanel = document.getElementById('proxy-panel');
        if (!proxyPanel) return;

        if (agentsArray.length === 0) {
            // 연결 실패시 최소 크기
            proxyPanel.style.width = '320px';
            proxyPanel.style.minHeight = 'auto';
        } else {
            // Agent 개수에 따른 크기 계산
            let totalItems = agentsArray.length; // Agent 개수
            
            // 확장된 Agent들의 MCP 서버 개수 계산
            agentsArray.forEach(agent => {
                if (agent.expanded && agent.mcpServers) {
                    totalItems += agent.mcpServers.length;
                    
                    // 확장된 MCP 서버들의 도구 개수 계산
                    agent.mcpServers.forEach(mcpServer => {
                        if (mcpServer.expanded && mcpServer.tools) {
                            totalItems += Math.ceil(mcpServer.tools.length / 3); // 도구는 3개씩 한 줄
                        }
                    });
                }
            });

            // 동적 크기 설정
            const baseWidth = 360; // 너비 증가
            const baseHeight = 120; // 헤더 + 여백
            const itemHeight = 48; // 각 항목당 평균 높이
            
            const calculatedHeight = baseHeight + (totalItems * itemHeight);
            const maxHeight = Math.min(calculatedHeight, window.innerHeight - 120);

            proxyPanel.style.width = `${baseWidth}px`;
            proxyPanel.style.maxHeight = `${maxHeight}px`;
        }
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
        
        // UI 업데이트 (패널 크기 자동 조절 포함)
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
    }

    // MCP 서버 확장/축소
    toggleMCPServerExpand(agentId, mcpServerId) {
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        if (!agent.mcpServers) return;
        
        const mcpServer = agent.mcpServers.find(server => server.id === mcpServerId);
        if (!mcpServer) return;
        
        mcpServer.expanded = !mcpServer.expanded;
        
        // UI 업데이트 (패널 크기 자동 조절 포함)
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
    }

    // Agent 활성화/비활성화
    toggleAgent(agentId) {
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        
        if (agent.type === 'demo-agent') {
            // 데모 모드에서는 토글만 시뮬레이션
            agent.enabled = !agent.enabled;
            agent.status = agent.enabled ? 'connected' : 'disconnected';
            
        } else {
            // 실제 Agent 토글 로직 (추후 구현)
        }
        
        // UI 업데이트 (패널 크기 자동 조절 포함)
        this.renderServerList();
        
        // 상태 저장
        this.saveServerStates();
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

        // 연결 시도 중일 때는 패널 토글 차단
        if (this.isConnecting) {
            return;
        }

        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            proxyStatus.classList.add('active');
            proxyPanel.classList.add('active');
            
            // 패널 열릴 때는 현재 상태만 표시 (연결 시도 안함)
            this.updateAgentList();
            this.updateProxyStatus(true); // skipHealthCheck = true
            this.updateUI();
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


    
    // Agent 상태 저장
    saveServerStates() {
        const agentStates = {};
        for (const [agentId, agent] of this.servers.entries()) {
            agentStates[agentId] = {
                enabled: agent.enabled,
                expanded: agent.expanded
            };
        }
        localStorage.setItem('agent-states', JSON.stringify(agentStates));
    }
    
    // Agent 상태 복원
    loadServerStates() {
        try {
            const saved = localStorage.getItem('agent-states');
            if (saved) {
                const agentStates = JSON.parse(saved);
                for (const [agentId, agent] of this.servers.entries()) {
                    if (agentStates[agentId]) {
                        const savedState = agentStates[agentId];
                        if (savedState.enabled !== undefined) {
                            agent.enabled = savedState.enabled;
                        }
                        if (savedState.expanded !== undefined) {
                            agent.expanded = savedState.expanded;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Agent 상태 복원 실패:', error);
        }
    }

    // 도구 실행 테스트
    async testTool(toolName) {
        try {
            
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
            return false;
        }
    }
}

function toggleProxyPanel() {
// 전역 함수들
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleProxyPanel();
    }
}

async function refreshProxyStatus() {
    if (window.proxyStatusManager) {
        // 이미 연결 시도 중이면 무시
        if (window.proxyStatusManager.isConnecting) {
            return;
        }
        
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
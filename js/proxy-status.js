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
        
        // 페이지 새로고침 시 세션 초기화 경고
        window.addEventListener('beforeunload', (e) => {
            const confirmationMessage = '페이지를 새로고침하면 현재 세션이 초기화되고 모든 기록이 사라집니다. 정말 새로고침하시겠습니까?';
            e.preventDefault();
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        });
        
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

                    // Generate fallback ID if agent.id is not available
                    const agentId = agent.id || `agent-${agent.name ? agent.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'}`;
                    
                    this.servers.set(agentId, {
                        id: agentId,
                        name: agent.name,
                        url: agent.description || 'AI Agent',
                        status: (agent.status === 'active' || agent.status === 'healthy') ? 'connected' : 'disconnected', 
                        enabled: (agent.status === 'active' || agent.status === 'healthy'),
                        type: window.proxyAPI.isConnected ? 'agent' : 'demo-agent',
                        expanded: false,
                        // Tools directly under agent
                        tools: agent.skills ? agent.skills.map(skill => ({ 
                            name: skill.name, 
                            description: skill.description 
                        })) : [
                            { name: 'query_processing' },
                            { name: 'response_generation' }
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

    // 캐시된 데이터만 사용하여 Agent 목록 업데이트 (재연결 시도 안함)
    updateAgentListFromCache() {
        // Agent → 도구 계층 구조로 변환
        this.servers.clear();
        
        if (window.proxyAPI) {
            // 캐시된 상태만 가져오기 (네트워크 호출 안함)
            const status = window.proxyAPI.getStatus();
            
            if (status.agents && status.agents.length > 0) {
                status.agents.forEach(agent => {
                    // Generate fallback ID if agent.id is not available
                    const agentId = agent.id || `agent-${agent.name ? agent.name.toLowerCase().replace(/\s+/g, '-') : 'unknown'}`;
                    
                    this.servers.set(agentId, {
                        id: agentId,
                        name: agent.name,
                        url: agent.description || 'AI Agent',
                        status: (agent.status === 'active' || agent.status === 'healthy') ? 'connected' : 'disconnected', 
                        enabled: (agent.status === 'active' || agent.status === 'healthy'),
                        type: window.proxyAPI.isConnected ? 'agent' : 'demo-agent',
                        expanded: false,
                        // Tools directly under agent
                        tools: agent.skills ? agent.skills.map(skill => ({ 
                            name: skill.name, 
                            description: skill.description 
                        })) : [
                            { name: 'query_processing' },
                            { name: 'response_generation' }
                        ]
                    });
                });
            }
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
                    <div class="agent-toggle" onclick="toggleAgent('${agent.id}', event)">
                        <div class="toggle-switch ${agent.enabled ? 'on' : 'off'}">
                            <div class="toggle-knob"></div>
                        </div>
                    </div>
                </div>
                <div class="agent-tools">
                    ${!agent.enabled ? '' : 
                        !agent.tools || agent.tools.length === 0 ? 
                            '<div class="empty-state">사용 가능한 도구가 없습니다</div>' :
                            `<div class="tools-grid">
                                ${agent.tools.map(tool => `
                                    <div class="tool-tag" title="${tool.description || tool.name}" onclick="testTool('${tool.name}', '${agent.id}')">
                                        ${tool.name}
                                    </div>
                                `).join('')}
                            </div>`
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
                                <div class="tool-tag" title="${tool.description || tool.name}" onclick="testTool('${tool.name}', '${mcpServer.id}')">
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
    toggleAgent(agentId, event) {
        if (event) {
            event.stopPropagation(); // 확장/축소 이벤트와 충돌 방지
        }
        
        if (!this.servers.has(agentId)) return;
        
        const agent = this.servers.get(agentId);
        
        // 항상 토글 가능하도록 수정 (demo-agent 조건 제거)
        agent.enabled = !agent.enabled;
        agent.status = agent.enabled ? 'connected' : 'disconnected';
        
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
            
            // 패널 열릴 때는 현재 캐시된 상태만 표시 (재연결 시도 안함)
            this.updateAgentListFromCache();
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
        // 도구 클릭 시 프롬프트 입력 방지 - 아무 작업도 하지 않음
        return false;
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
        
        // 새로고침 확인 메시지 표시
        const confirmed = confirm('Agent 연결 상태를 새로고침하면 현재 세션이 초기화될 수 있습니다. 계속하시겠습니까?');
        if (!confirmed) {
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
function toggleAgent(agentId, event) {
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleAgent(agentId, event);
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
    // 도구 클릭 시 프롬프트 입력 및 메시지 표시 방지 - 아무 작업도 하지 않음
    return;
}

// 전역 Proxy Status Manager 인스턴스
document.addEventListener('DOMContentLoaded', () => {
    window.proxyStatusManager = new ProxyStatusManager();
});
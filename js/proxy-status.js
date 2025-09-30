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
                statusText.textContent = 'Agent Server (연결 확인 중...)';
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
                    statusText.textContent = 'Agent Server (연결 확인 중...)';
                    
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
                        // Health check failed
                        isConnected = false;
                        status = { agents: [] };
                    }
                }
            }
            
            // 연결 상태에 따른 상태 표시 업데이트
            if (isConnected) {
                statusLight.className = 'status-light connected green';
                const agentCount = status.agents ? status.agents.length : 0;
                statusText.textContent = `Agent Server (${agentCount})`;
            } else {
                // 연결 실패시 빨간색 표시
                statusLight.className = 'status-light error red';
                statusText.textContent = `Agent Server (연결 실패)`;
            }
            
        } catch (error) {
            // 에러 발생시도 빨간색 표시
            statusLight.className = 'status-light error red';
            statusText.textContent = `Agent Server (연결 실패)`;
        }
    }


    async updateAgentList() {
        // Agent → MCP 서버 → 도구 계층 구조로 변환
        this.servers.clear();
        
        if (window.proxyAPI) {
            // Proxy API 상태 가져오기 (연결 상태와 관계없이)
            const status = window.proxyAPI.getStatus();
            
            if (status.agents && status.agents.length > 0) {
                
                status.agents.forEach((agent, index) => {
                    // AgentInfo 구조: { id, name, description, status, skills }
                    // Processing agent
                    const agentId = agent.id || `agent-${index}`;

                    this.servers.set(agentId, {
                        id: agentId,
                        name: agent.name,
                        url: agent.description || 'AI Agent',
                        status: agent.status === 'healthy' ? 'connected' : 'disconnected',
                        enabled: true, // 기본적으로 활성화 상태로 시작
                        type: window.proxyAPI.isConnected ? 'agent' : 'demo-agent',
                        expanded: false,
                        // skills 필드 사용
                        tools: agent.skills && agent.skills.length > 0 ?
                            agent.skills.map((skill, toolIndex) => {
                                let name, description;
                                if (typeof skill === 'string') {
                                    name = skill;
                                    description = `${skill} 기능`;
                                } else if (skill && typeof skill === 'object') {
                                    name = skill.name || skill.toString();
                                    description = skill.description || `${name} 기능`;
                                } else {
                                    name = skill.toString();
                                    description = `${name} 기능`;
                                }
                                return {
                                    id: `${agentId}-tool-${toolIndex}`,
                                    name: name,
                                    description: description,
                                    enabled: true
                                };
                            }) :
                            []  // skills가 없으면 빈 배열
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
                `<div class="agents-list">${agentsArray.map(agent => this.renderAgent(agent)).join('')}</div>`
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

            // 확장된 Agent들의 도구 개수 계산
            agentsArray.forEach(agent => {
                if (agent.expanded && agent.tools) {
                    totalItems += agent.tools.length;
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
                ${agent.expanded ?
                    `<div class="agent-tools">
                        ${!agent.enabled ? '' :
                            !agent.tools || agent.tools.length === 0 ?
                                '<div class="empty-state">사용 가능한 도구가 없습니다</div>' :
                                `<div class="tools-list">
                                    ${agent.tools.map(tool => this.renderTool(tool, agent.id)).join('')}
                                </div>`
                        }
                    </div>` : ''
                }
            </div>
        `;
    }

    renderTool(tool, agentId) {
        const description = tool.description || `${tool.name} 기능`;
        return `
            <div class="tool-item ${tool.enabled ? '' : 'disabled'}" 
                 data-tooltip="${description.replace(/"/g, '&quot;')}"
                 onmouseenter="adjustTooltipPosition(this)"
                 onmouseleave="resetTooltipPosition(this)">
                <div class="tool-info">
                    <span class="tool-name">${tool.name}</span>
                </div>
                <div class="tool-toggle" onclick="event.stopPropagation(); toggleTool('${agentId}', '${tool.id}')">
                    <div class="toggle-switch ${tool.enabled ? 'on' : 'off'}">
                        <div class="toggle-knob"></div>
                    </div>
                </div>
                <div class="tool-tooltip">
                    <span class="tooltip-text">${description}</span>
                </div>
            </div>
        `;
    }

    getAgentStatusClass(agent) {
        // Getting status class for agent

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

    // Tool 활성화/비활성화
    toggleTool(agentId, toolId) {
        if (!this.servers.has(agentId)) return;

        const agent = this.servers.get(agentId);
        if (!agent.tools) return;

        const tool = agent.tools.find(t => t.id === toolId);
        if (!tool) return;

        tool.enabled = !tool.enabled;

        // UI 업데이트
        this.renderServerList();

        // 상태 저장
        this.saveServerStates();
    }

    // Agent 활성화/비활성화
    toggleAgent(agentId) {
        // Toggling agent

        if (!this.servers.has(agentId)) {
            // Agent not found in servers
            return;
        }

        const agent = this.servers.get(agentId);
        // Agent before toggle

        // 실제 Agent 토글 로직 구현
        agent.enabled = !agent.enabled;

        if (agent.enabled) {
            // Agent를 활성화할 때는 원래 상태를 복원
            agent.status = 'connected';
        } else {
            // Agent를 비활성화할 때는 off 상태로 설정
            agent.status = 'disconnected';
        }

        // Agent after toggle

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
                expanded: agent.expanded,
                tools: agent.tools ? agent.tools.map(t => ({ id: t.id, enabled: t.enabled })) : []
            };
        }
        // Saving agent states
        localStorage.setItem('agent-states', JSON.stringify(agentStates));
    }

    // 디버깅용: 저장된 상태 초기화
    clearServerStates() {
        localStorage.removeItem('agent-states');
        // Cleared all saved agent states
        // 새로고침
        this.refreshStatus();
    }
    
    // Agent 상태 복원
    loadServerStates() {
        try {
            const saved = localStorage.getItem('agent-states');
            if (saved) {
                const agentStates = JSON.parse(saved);
                // Loading saved agent states

                for (const [agentId, agent] of this.servers.entries()) {
                    if (agentStates[agentId]) {
                        const savedState = agentStates[agentId];
                        // enabled 상태는 저장된 값을 사용하되, 상태에 따라 status도 업데이트
                        if (savedState.enabled !== undefined) {
                            agent.enabled = savedState.enabled;
                            // enabled 상태에 따라 status도 적절히 설정
                            if (!agent.enabled) {
                                agent.status = 'disconnected';
                            } else if (agent.status === 'disconnected') {
                                agent.status = 'connected'; // healthy agent가 비활성화 상태였다면 다시 활성화
                            }
                        }
                        if (savedState.expanded !== undefined) {
                            agent.expanded = savedState.expanded;
                        }

                        // Tool 상태 복원
                        if (savedState.tools && agent.tools) {
                            savedState.tools.forEach(savedTool => {
                                const tool = agent.tools.find(t => t.id === savedTool.id);
                                if (tool) {
                                    tool.enabled = savedTool.enabled;
                                }
                            });
                        }

                        // Restored state for agent
                    }
                }
            } else {
                // No saved agent states found
            }
        } catch (error) {
            // Agent state restoration failed
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

// Tool 활성화/비활성화
function toggleTool(agentId, toolId) {
    if (window.proxyStatusManager) {
        window.proxyStatusManager.toggleTool(agentId, toolId);
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

// 디버깅용 전역 함수
function clearAgentStates() {
    if (window.proxyStatusManager) {
        window.proxyStatusManager.clearServerStates();
    }
}

// 툴팁 위치 조정 함수
function adjustTooltipPosition(element) {
    const tooltip = element.querySelector('.tool-tooltip');
    if (!tooltip) return;
    
    // 툴팁 표시 전 위치 계산
    setTimeout(() => {
        const rect = tooltip.getBoundingClientRect();
        const parentRect = element.getBoundingClientRect();
        const panelRect = document.querySelector('.proxy-panel').getBoundingClientRect();
        
        // 툴팁이 패널 좌측 경계를 벗어나는 경우
        if (rect.left < panelRect.left + 10) {
            tooltip.style.left = '10px';
            tooltip.style.transform = 'translateX(0) translateY(-4px)';
        }
        // 툴팁이 패널 우측 경계를 벗어나는 경우
        else if (rect.right > panelRect.right - 10) {
            tooltip.style.left = 'auto';
            tooltip.style.right = '10px';
            tooltip.style.transform = 'translateX(0) translateY(-4px)';
        }
        // 기본 중앙 정렬
        else {
            tooltip.style.left = '50%';
            tooltip.style.right = 'auto';
            tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
        }
    }, 10);
}

// 툴팁 위치 초기화 함수
function resetTooltipPosition(element) {
    const tooltip = element.querySelector('.tool-tooltip');
    if (!tooltip) return;
    
    tooltip.style.left = '50%';
    tooltip.style.right = 'auto';
    tooltip.style.transform = 'translateX(-50%)';
}

// 전역 Proxy Status Manager 인스턴스
document.addEventListener('DOMContentLoaded', () => {
    window.proxyStatusManager = new ProxyStatusManager();
});
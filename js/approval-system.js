class ApprovalSystem {
    constructor() {
        this.pendingActions = new Map();
        this.init();
    }

    init() {
        this.createApprovalModal();
    }

    createApprovalModal() {
        // 기존 모달과 컴팩트 승인 UI 모두 생성
        const modalHTML = `
            <div id="approval-modal" class="approval-modal" style="display: none;">
                <div class="approval-modal-overlay" onclick="approvalSystem.cancelAction()"></div>
                <div class="approval-modal-content">
                    <div class="approval-header">
                        <h3>🤖 AI 액션 승인</h3>
                        <button class="approval-close" onclick="approvalSystem.cancelAction()">×</button>
                    </div>
                    
                    <div class="approval-body">
                        <div class="ai-message-preview">
                            <div class="ai-avatar">🤖</div>
                            <div class="ai-response" id="approval-ai-response"></div>
                        </div>
                        
                        <div class="approval-action-info">
                            <div class="action-icon" id="approval-action-icon">📄</div>
                            <div class="action-details">
                                <h4 id="approval-action-title">페이지 이동</h4>
                                <p id="approval-action-description">포트폴리오 페이지로 이동하시겠습니까?</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="approval-footer">
                        <button class="approval-btn cancel-btn" onclick="approvalSystem.cancelAction()">
                            ❌ 취소
                        </button>
                        <button class="approval-btn approve-btn" onclick="approvalSystem.approveAction()">
                            ✅ 승인
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 컴팩트 승인 UI -->
            <div id="compact-approval" class="compact-approval" style="display: none;">
                <div class="compact-approval-message" id="compact-approval-message"></div>
                <div class="compact-approval-buttons">
                    <button class="compact-btn reject-btn" onclick="approvalSystem.cancelAction()" title="거부">✕</button>
                    <button class="compact-btn approve-btn" onclick="approvalSystem.approveAction()" title="승인">○</button>
                </div>
            </div>
        `;

        // 모달을 body에 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 액션 승인 요청
    async requestApproval(actionType, actionParams, aiResponse, context = {}) {
        return new Promise((resolve, reject) => {
            const actionId = 'action_' + Date.now();

            // 대기 중인 액션 저장
            this.pendingActions.set(actionId, {
                type: actionType,
                params: actionParams,
                aiResponse,
                context,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // 승인 모달 표시
            this.showApprovalModal(actionId, actionType, actionParams, aiResponse);
        });
    }

    showApprovalModal(actionId, actionType, actionParams, aiResponse) {
        // AI 메시지 바로 밑에 승인 UI 추가
        this.showInlineApproval(actionId, actionType, actionParams, aiResponse);
    }
    
    showInlineApproval(actionId, actionType, actionParams, aiResponse) {

        // 기존 승인 UI 모두 제거
        const existingApprovals = document.querySelectorAll('.inline-approval');
        existingApprovals.forEach(el => el.remove());

        // AI 메시지 찾기 - 다양한 선택자로 시도
        let aiMessages = document.querySelectorAll('.chat-message.ai');

        // 만약 못 찾으면 다른 선택자들도 시도
        if (aiMessages.length === 0) {
            aiMessages = document.querySelectorAll('.message.ai');
        }

        if (aiMessages.length === 0) {
            aiMessages = document.querySelectorAll('.ai-message');
        }

        if (aiMessages.length === 0) {
            aiMessages = document.querySelectorAll('[class*="ai"]');
        }

        const aiMessage = aiMessages[aiMessages.length - 1];

        if (!aiMessage) {
            this.showCompactApproval(actionId, actionType, actionParams, aiResponse);
            return;
        }

        // 액션 정보 설정
        const actionInfo = this.getActionInfo(actionType, actionParams);

        // 인라인 승인 UI 생성
        const approvalDiv = document.createElement('div');
        approvalDiv.className = 'inline-approval';
        approvalDiv.dataset.actionId = actionId;

        // 메인페이지 색감에 맞춘 세련된 디자인
        approvalDiv.style.cssText = `
            margin: 8px 0;
            padding: 16px 20px;
            background: linear-gradient(135deg, #ffeef8 0%, #f0f4ff 50%, #fff0f5 100%);
            border: 2px solid rgba(255, 192, 203, 0.3);
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            display: block !important;
            opacity: 1 !important;
            transform: translateY(0) !important;
            position: relative;
            z-index: 1000;
            width: 100% !important;
            min-width: 320px !important;
            min-height: 60px !important;
            max-width: 480px !important;
            box-sizing: border-box !important;
            backdrop-filter: blur(20px);
        `;

        approvalDiv.innerHTML = `
            <div class="inline-approval-content" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                <div class="approval-message" style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <span class="action-text" style="font-weight: 600; font-size: 15px; color: #4a5568; letter-spacing: -0.3px;">${actionInfo.description}</span>
                </div>
                <div class="approval-buttons" style="display: flex; gap: 8px;">
                    <button class="inline-btn reject-btn" onclick="approvalSystem.cancelAction()" title="거부"
                        style="width: 38px; height: 38px; border: 2px solid #ffc0cb; border-radius: 10px; background: white;
                        color: #e53e3e; cursor: pointer; display: flex; align-items: center; justify-content: center;
                        font-size: 16px; font-weight: 700; transition: all 0.2s ease;"
                        onmouseover="this.style.background='#fff5f5'; this.style.transform='scale(1.05)'; this.style.borderColor='#feb2b2'"
                        onmouseout="this.style.background='white'; this.style.transform='scale(1)'; this.style.borderColor='#ffc0cb'">✕</button>
                    <button class="inline-btn approve-btn" onclick="approvalSystem.approveAction()" title="승인"
                        style="width: 38px; height: 38px; border: 2px solid #ffc0cb; border-radius: 10px; background: linear-gradient(135deg, #ffeef8, #fff0f5);
                        color: #48bb78; cursor: pointer; display: flex; align-items: center; justify-content: center;
                        font-size: 16px; font-weight: 700; transition: all 0.2s ease;"
                        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(72, 187, 120, 0.2)'"
                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">✓</button>
                </div>
            </div>
        `;


        // 완전히 새로운 접근법: fixed position으로 화면에 강제 표시
        document.body.appendChild(approvalDiv);

        // fixed position으로 화면 중앙 상단에 표시
        approvalDiv.style.position = 'fixed';
        approvalDiv.style.top = '20px';
        approvalDiv.style.left = '50%';
        approvalDiv.style.transform = 'translateX(-50%)';
        approvalDiv.style.zIndex = '99999';
        approvalDiv.style.width = 'auto';
        approvalDiv.style.minWidth = '300px';
        approvalDiv.style.maxWidth = '500px';

        // 즉시 활성화 (애니메이션 제거)
        approvalDiv.classList.add('active');

        // 추가 확인을 위한 디버깅
        const rect = approvalDiv.getBoundingClientRect();
        // 승인 UI로 스크롤 이동
        approvalDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // 부드러운 등장 애니메이션
        approvalDiv.style.animation = 'slideInDown 0.4s ease-out';
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes slideInDown {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(styleSheet);

        // 자동 타임아웃 (30초)
        setTimeout(() => {
            if (this.pendingActions.has(actionId)) {
                this.cancelAction();
            }
        }, 30000);
    }
    
    // 폴백용 기존 컴팩트 승인 UI
    showCompactApproval(actionId, actionType, actionParams, aiResponse) {

        let compactApproval = document.getElementById('compact-approval');

        // compact-approval이 없으면 강제로 생성
        if (!compactApproval) {
            const approvalHTML = `
                <div id="compact-approval" class="compact-approval" style="display: none; position: fixed; top: 20px; right: 20px; background: white; border: 2px solid #007bff; border-radius: 8px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;">
                    <div class="compact-approval-message" id="compact-approval-message"></div>
                    <div class="compact-approval-buttons" style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="compact-btn reject-btn" onclick="approvalSystem.cancelAction()" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" title="거부">✕</button>
                        <button class="compact-btn approve-btn" onclick="approvalSystem.approveAction()" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" title="승인">○</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', approvalHTML);
            compactApproval = document.getElementById('compact-approval');
        }

        const messageEl = document.getElementById('compact-approval-message');

        // 액션 정보 설정
        const actionInfo = this.getActionInfo(actionType, actionParams);

        if (messageEl) {
            messageEl.innerHTML = `
                <span class="action-icon">${actionInfo.icon}</span>
                <span class="action-text">${actionInfo.description}</span>
            `;
        }

        // 현재 액션 ID 저장
        compactApproval.dataset.actionId = actionId;

        // 컴팩트 UI 표시
        compactApproval.style.display = 'flex';

        // 애니메이션
        setTimeout(() => {
            compactApproval.classList.add('active');
        }, 10);

        // 자동 타임아웃 (30초)
        setTimeout(() => {
            if (this.pendingActions.has(actionId)) {
                this.cancelAction();
            }
        }, 30000);
    }

    getActionInfo(actionType, actionParams) {
        const actionMap = {
            'navigate': {
                icon: this.getPageIcon(actionParams.page),
                title: '페이지 이동',
                description: `${this.getPageName(actionParams.page)} 페이지로 이동하시겠습니까?`
            },
            'scroll': {
                icon: '⬇️',
                title: '스크롤 이동',
                description: `${actionParams.element} 섹션으로 스크롤하시겠습니까?`
            },
            'download': {
                icon: '📥',
                title: '파일 다운로드',
                description: `${actionParams.filename} 파일을 다운로드하시겠습니까?`
            },
            'external_link': {
                icon: '🔗',
                title: '외부 링크',
                description: `${actionParams.url}로 이동하시겠습니까?`
            }
        };

        return actionMap[actionType] || {
            icon: '⚡',
            title: '액션 실행',
            description: '이 액션을 실행하시겠습니까?'
        };
    }

    getPageIcon(page) {
        const pageIcons = {
            'portfolio': '💼',
            'resume': '📄',
            'skills': '🛠️',
            'blog': '📝'
        };
        return pageIcons[page] || '📄';
    }

    getPageName(page) {
        const pageNames = {
            'portfolio': '포트폴리오',
            'resume': '이력서',
            'skills': '기술스택',
            'blog': '블로그'
        };
        return pageNames[page] || page;
    }

    // 액션 승인
    approveAction() {
        // 인라인 승인 UI 먼저 확인
        const inlineApproval = document.querySelector('.inline-approval');
        const compactApproval = document.getElementById('compact-approval');

        let actionId;
        if (inlineApproval && inlineApproval.dataset.actionId) {
            actionId = inlineApproval.dataset.actionId;
        } else if (compactApproval && compactApproval.dataset.actionId) {
            actionId = compactApproval.dataset.actionId;
        }

        if (!actionId || !this.pendingActions.has(actionId)) {
            console.error('승인할 액션을 찾을 수 없습니다:', actionId);
            return;
        }

        const action = this.pendingActions.get(actionId);
        
        // 승인 기록
        if (window.sessionManager) {
            window.sessionManager.addMessage('system', `사용자가 ${action.type} 액션을 승인했습니다.`, {
                actionType: action.type,
                actionParams: action.params,
                approved: true
            });
        }

        
        // Promise resolve
        action.resolve({
            approved: true,
            actionType: action.type,
            actionParams: action.params
        });

        // 정리
        this.pendingActions.delete(actionId);
        this.hideApprovalModal();
    }

    // 액션 취소
    cancelAction() {
        // 인라인 승인 UI 먼저 확인
        const inlineApproval = document.querySelector('.inline-approval');
        const compactApproval = document.getElementById('compact-approval');
        
        let actionId;
        if (inlineApproval && inlineApproval.dataset.actionId) {
            actionId = inlineApproval.dataset.actionId;
        } else if (compactApproval && compactApproval.dataset.actionId) {
            actionId = compactApproval.dataset.actionId;
        }
        
        if (actionId && this.pendingActions.has(actionId)) {
            const action = this.pendingActions.get(actionId);
            
            // 취소 기록
            if (window.sessionManager) {
                window.sessionManager.addMessage('system', `사용자가 ${action.type} 액션을 취소했습니다.`, {
                    actionType: action.type,
                    actionParams: action.params,
                    approved: false
                });
            }

            // Promise reject
            action.reject(new Error('사용자가 액션을 취소했습니다.'));
            
            // 정리
            this.pendingActions.delete(actionId);
        }

        this.hideApprovalModal();
    }

    hideApprovalModal() {
        // 인라인 승인 UI 제거
        const inlineApproval = document.querySelector('.inline-approval');
        if (inlineApproval) {
            inlineApproval.classList.remove('active');
            setTimeout(() => {
                inlineApproval.remove();
            }, 300);
        }
        
        // 컴팩트 승인 UI도 제거 (폴백용)
        const compactApproval = document.getElementById('compact-approval');
        if (compactApproval) {
            compactApproval.classList.remove('active');
            setTimeout(() => {
                compactApproval.style.display = 'none';
                compactApproval.dataset.actionId = '';
            }, 300);
        }
    }

    // 대기 중인 액션들 정리 (메모리 누수 방지)
    cleanupExpiredActions() {
        const now = Date.now();
        const expiredTime = 5 * 60 * 1000; // 5분

        for (const [actionId, action] of this.pendingActions.entries()) {
            if (now - action.timestamp > expiredTime) {
                action.reject(new Error('액션이 만료되었습니다.'));
                this.pendingActions.delete(actionId);
            }
        }
    }
}

// 전역 승인 시스템 인스턴스
window.approvalSystem = new ApprovalSystem();

// 주기적으로 만료된 액션 정리 (5분마다)
setInterval(() => {
    window.approvalSystem.cleanupExpiredActions();
}, 5 * 60 * 1000);
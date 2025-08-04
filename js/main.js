class PortfolioApp {
    constructor() {
        this.chatMessages = [];
        this.isInitialized = false;
        this.init();
    }

    init() {
        // 채팅 관련 이벤트 리스너 설정
        this.setupEventListeners();
        this.isInitialized = true;
    }

    setupEventListeners() {
        // 엔터키로 메시지 전송
        const chatInput = document.getElementById('chat-input');
        const userInput = document.getElementById('user-input');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUserInput();
                }
            });
        }
    }

    handleUserInput() {
        const input = document.getElementById('user-input');
        const userMessage = input.value.trim();
        
        if (!userMessage) return;

        // 사용자 입력 처리 로직
        this.processUserQuery(userMessage);
        input.value = '';
    }

    processUserQuery(query) {
        const lowerQuery = query.toLowerCase();
        
        // 페이지 네비게이션 키워드 체크
        if (lowerQuery.includes('포트폴리오')) {
            navigateToPage('portfolio');
        } else if (lowerQuery.includes('이력서')) {
            navigateToPage('resume');
        } else if (lowerQuery.includes('기술스택') || lowerQuery.includes('기술 스택')) {
            navigateToPage('skills');
        } else if (lowerQuery.includes('블로그') || lowerQuery.includes('기술블로그') || lowerQuery.includes('글')) {
            navigateToPage('blog');
        } else {
            // 일반적인 질문으로 처리
            alert(`"${query}"에 대한 답변을 준비 중입니다. 곧 구현될 예정입니다!`);
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        // 채팅 메시지 추가
        this.addChatMessage('user', message);
        
        // AI 응답 시뮬레이션
        setTimeout(() => {
            this.generateAIResponse(message);
        }, 1000);

        input.value = '';
    }

    addChatMessage(sender, message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const messageStyle = sender === 'user' 
            ? 'background: #667eea; color: white; margin-left: 20px; border-radius: 15px 15px 5px 15px;'
            : 'background: #f1f3f4; color: #333; margin-right: 20px; border-radius: 15px 15px 15px 5px;';
            
        messageDiv.innerHTML = `
            <div style="padding: 10px 15px; margin: 5px 0; ${messageStyle}">
                ${message}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    generateAIResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        let response = '';

        if (lowerMessage.includes('안녕') || lowerMessage.includes('hello')) {
            response = '안녕하세요! 김동휘의 포트폴리오에 오신 것을 환영합니다. 무엇을 도와드릴까요?';
        } else if (lowerMessage.includes('포트폴리오')) {
            response = '포트폴리오 페이지로 이동하시겠습니까? "포트폴리오"라고 입력하시면 해당 페이지로 이동합니다.';
        } else if (lowerMessage.includes('기술') || lowerMessage.includes('스킬')) {
            response = '제가 보유한 기술스택에 대해 궁금하시군요! 기술스택 페이지에서 자세한 정보를 확인하실 수 있습니다.';
        } else if (lowerMessage.includes('경력') || lowerMessage.includes('이력')) {
            response = '경력과 이력에 대한 정보는 이력서 페이지에서 확인하실 수 있습니다.';
        } else if (lowerMessage.includes('블로그') || lowerMessage.includes('글') || lowerMessage.includes('포스트')) {
            response = '기술블로그에서 제가 작성한 글들을 확인하실 수 있습니다. 새로운 글도 작성할 수 있어요!';
        } else {
            response = `"${userMessage}"에 대한 답변을 준비하고 있습니다. 포트폴리오, 이력서, 기술스택, 기술블로그에 대해 질문해보세요!`;
        }

        this.addChatMessage('ai', response);
    }

    openChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');
        
        chatContainer.style.display = 'flex';
        chatFloatBtn.style.display = 'none';
        
        // 애니메이션을 위한 delay
        setTimeout(() => {
            chatContainer.classList.add('active');
        }, 10);
    }

    closeChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatFloatBtn = document.getElementById('chat-float-btn');
        
        chatContainer.classList.remove('active');
        
        setTimeout(() => {
            chatContainer.style.display = 'none';
            chatFloatBtn.style.display = 'flex';
        }, 300);
    }

    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const isActive = chatContainer.classList.contains('active');
        
        if (isActive) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
}

// 전역 함수들
function handleUserInput() {
    if (window.portfolioApp) {
        window.portfolioApp.handleUserInput();
    }
}

function sendChatMessage() {
    if (window.portfolioApp) {
        window.portfolioApp.sendChatMessage();
    }
}

function openChat() {
    if (window.portfolioApp) {
        window.portfolioApp.openChat();
    }
}

function closeChat() {
    if (window.portfolioApp) {
        window.portfolioApp.closeChat();
    }
}

function toggleChat() {
    if (window.portfolioApp) {
        window.portfolioApp.toggleChat();
    }
}

function toggleTheme() {
    if (window.gradientManager) {
        window.gradientManager.toggleDarkMode();
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioApp = new PortfolioApp();
});
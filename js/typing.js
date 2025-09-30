class TypingAnimation {
    constructor() {
        this.welcomeMessage = "김동휘 웹 페이지";
        this.instructionText = "궁금한 내용을 입력해주세요";
        this.currentStep = 0;
    }

    async typeText(element, text, speed = 100) {
        return new Promise((resolve) => {
            element.classList.add('typing-cursor');
            let index = 0;
            
            const typeInterval = setInterval(() => {
                if (index < text.length) {
                    element.textContent += text.charAt(index);
                    index++;
                } else {
                    element.classList.remove('typing-cursor');
                    clearInterval(typeInterval);
                    resolve();
                }
            }, speed);
        });
    }

    async startTypingSequence() {
        const welcomeElement = document.getElementById('welcome-message');
        const instructionElement = document.getElementById('instruction-text');
        const quickButtonsElement = document.getElementById('quick-buttons');
        const inputContainerElement = document.getElementById('input-container');

        // 첫 번째 메시지 타이핑
        await this.typeText(welcomeElement, this.welcomeMessage, 80);
        
        // 잠시 대기
        await this.delay(800);
        
        // 두 번째 메시지 타이핑
        await this.typeText(instructionElement, this.instructionText, 80);
        
        // 잠시 대기
        await this.delay(600);
        
        // 퀵 버튼들 표시
        quickButtonsElement.style.display = 'flex';
        this.fadeIn(quickButtonsElement);
        
        // 잠시 대기
        await this.delay(400);
        
        // 채팅 래퍼 표시
        const chatWrapper = document.getElementById('chat-wrapper');
        if (chatWrapper) {
            chatWrapper.style.display = 'block';
            this.fadeIn(chatWrapper);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    fadeIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 100);
    }
}

// 페이지 로드 시 타이핑 애니메이션 시작
document.addEventListener('DOMContentLoaded', () => {
    const typing = new TypingAnimation();
    
    // 페이지 로드 후 잠시 대기한 후 애니메이션 시작
    setTimeout(() => {
        typing.startTypingSequence();
    }, 500);
});
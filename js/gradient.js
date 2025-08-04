class GradientManager {
    constructor() {
        this.lightGradients = [
            // LG 오브제 컬렉션 스타일 파스텔 그라데이션들 (라이트 모드)
            'linear-gradient(135deg, #ffeef8 0%, #f0f4ff 25%, #fff0f5 50%, #f5f9ff 75%, #fef7f0 100%)',
            'linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 25%, #fff5ee 50%, #f5f0ff 75%, #ffe8f0 100%)',
            'linear-gradient(135deg, #f0f8ff 0%, #fff0f5 25%, #f5f9ff 50%, #fef7f0 75%, #f0fff0 100%)',
            'linear-gradient(135deg, #fff5ee 0%, #f5f0ff 25%, #e8f5e8 50%, #ffeef8 75%, #f0f8ff 100%)',
            'linear-gradient(135deg, #f5f9ff 0%, #fef7f0 25%, #f0fff0 50%, #fff0f5 75%, #f5f0ff 100%)',
            'linear-gradient(135deg, #ffe8f0 0%, #e8f5e8 25%, #f0f8ff 50%, #fff5ee 75%, #ffeef8 100%)',
            'linear-gradient(135deg, #f8f0ff 0%, #fff8f0 25%, #f0fff8 50%, #f8fff0 75%, #fff0f8 100%)',
            'linear-gradient(135deg, #f0fff8 0%, #f8fff0 25%, #fff0f8 50%, #f8f0ff 75%, #fff8f0 100%)'
        ];
        
        this.darkGradients = [
            // 다크 모드용 그라데이션들
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #7209b7 100%)',
            'linear-gradient(135deg, #2d1b69 0%, #11998e 25%, #38ef7d 50%, #2193b0 75%, #6dd5ed 100%)',
            'linear-gradient(135deg, #434343 0%, #000000 25%, #2c3e50 50%, #3498db 75%, #9b59b6 100%)',
            'linear-gradient(135deg, #8360c3 0%, #2ebf91 25%, #2980b9 50%, #8e44ad 75%, #3498db 100%)',
            'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
            'linear-gradient(135deg, #360033 0%, #0b8793 25%, #667eea 50%, #764ba2 75%, #f093fb 100%)',
            'linear-gradient(135deg, #141e30 0%, #243b55 25%, #2c5364 50%, #0f4c75 75%, #3282b8 100%)',
            'linear-gradient(135deg, #2c3e50 0%, #34495e 25%, #8e44ad 50%, #9b59b6 75, #3498db 100%)'
        ];
        
        this.currentGradientIndex = 0;
        this.isDarkMode = this.getStoredTheme() === 'dark' || 
                          (!this.getStoredTheme() && window.matchMedia('(prefers-color-scheme: dark)').matches);
        this.init();
    }
    
    getStoredTheme() {
        return localStorage.getItem('theme');
    }
    
    setStoredTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    init() {
        // 초기 테마 설정
        this.applyTheme();
        
        // 페이지 로드 시 랜덤 그라데이션 적용
        this.setRandomGradient();
        
        // 메인 페이지로 돌아갈 때마다 색상 변경을 위한 이벤트 리스너
        this.setupNavigationListeners();
        
        // 시스템 다크모드 변경 감지
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                this.isDarkMode = e.matches;
                this.applyTheme();
                this.setRandomGradient();
            }
        });
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        document.body.classList.toggle('dark-mode', this.isDarkMode);
    }

    setRandomGradient() {
        const gradients = this.isDarkMode ? this.darkGradients : this.lightGradients;
        const randomIndex = Math.floor(Math.random() * gradients.length);
        const selectedGradient = gradients[randomIndex];
        
        // CSS 변수 업데이트
        document.documentElement.style.setProperty('--dynamic-gradient', selectedGradient);
        this.currentGradientIndex = randomIndex;
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        this.setStoredTheme(this.isDarkMode ? 'dark' : 'light');
        this.applyTheme();
        this.setRandomGradient();
        
        // 커스텀 이벤트 발생
        document.dispatchEvent(new CustomEvent('themeChange', {
            detail: { isDarkMode: this.isDarkMode }
        }));
    }

    setupNavigationListeners() {
        // 페이지 네비게이션 감지를 위한 커스텀 이벤트 리스너
        document.addEventListener('pageNavigation', (event) => {
            if (event.detail.page === 'home') {
                // 홈으로 돌아갈 때 새로운 그라데이션 적용
                this.setRandomGradient();
            }
        });

        // 브라우저 새로고침/재방문 시에도 랜덤 적용
        window.addEventListener('beforeunload', () => {
            this.setRandomGradient();
        });
    }

    // 수동으로 다음 그라데이션으로 변경
    nextGradient() {
        this.currentGradientIndex = (this.currentGradientIndex + 1) % this.gradients.length;
        const selectedGradient = this.gradients[this.currentGradientIndex];
        document.documentElement.style.setProperty('--dynamic-gradient', selectedGradient);
    }

    // 특정 그라데이션 설정
    setGradient(index) {
        if (index >= 0 && index < this.gradients.length) {
            this.currentGradientIndex = index;
            const selectedGradient = this.gradients[index];
            document.documentElement.style.setProperty('--dynamic-gradient', selectedGradient);
        }
    }
}

// 전역 그라데이션 매니저 인스턴스
window.gradientManager = new GradientManager();
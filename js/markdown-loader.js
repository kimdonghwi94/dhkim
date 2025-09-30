class MarkdownLoader {
    constructor() {
        this.cache = new Map();
        this.initMarkdownParser();
    }

    initMarkdownParser() {
        // BlogManager와 동일한 마크다운 파서 사용
    }

    parseMarkdown(markdown) {
        if (!markdown) return '';
        
        // 줄 단위로 처리
        const lines = markdown.split('\n');
        const result = [];
        let inList = false;
        let inParagraph = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmedLine = line.trim();
            
            // 빈 줄 처리
            if (!trimmedLine) {
                if (inList) {
                    result.push('</ul>');
                    inList = false;
                }
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                continue;
            }
            
            // 헤더 처리
            if (trimmedLine.startsWith('# ')) {
                if (inList) { result.push('</ul>'); inList = false; }
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                result.push(`<h1>${trimmedLine.substring(2)}</h1>`);
                continue;
            }
            if (trimmedLine.startsWith('## ')) {
                if (inList) { result.push('</ul>'); inList = false; }
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                result.push(`<h2>${trimmedLine.substring(3)}</h2>`);
                continue;
            }
            if (trimmedLine.startsWith('### ')) {
                if (inList) { result.push('</ul>'); inList = false; }
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                result.push(`<h3>${trimmedLine.substring(4)}</h3>`);
                continue;
            }
            
            // 리스트 처리
            if (trimmedLine.startsWith('* ')) {
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                if (!inList) {
                    result.push('<ul>');
                    inList = true;
                }
                let listContent = trimmedLine.substring(2);
                listContent = this.parseInlineMarkdown(listContent);
                result.push(`<li>${listContent}</li>`);
                continue;
            }
            
            // 구분선 처리
            if (trimmedLine === '---') {
                if (inList) { result.push('</ul>'); inList = false; }
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                result.push('<hr>');
                continue;
            }
            
            // 일반 텍스트 처리
            if (!inList) {
                if (!inParagraph) {
                    result.push('<p>');
                    inParagraph = true;
                }
                
                let processedLine = this.parseInlineMarkdown(trimmedLine);
                result.push(processedLine);
            }
        }
        
        // 마지막에 열린 태그들 닫기
        if (inList) result.push('</ul>');
        if (inParagraph) result.push('</p>');
        
        // 각 요소를 블록 레벨로 처리
        const html = result.join('\n');
        
        // 추가 정리
        return html
            .replace(/\n+/g, '\n')  // 여러 줄바꿈을 하나로
            .replace(/^\n+|\n+$/g, '')  // 시작/끝 줄바꿈 제거
            .trim();
    }
    
    parseInlineMarkdown(text) {
        // 코드 블록 처리
        text = text.replace(/```([^`]*?)```/g, '<pre><code>$1</code></pre>');
        
        // 인라인 코드 처리
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 강조 처리
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // 링크 처리
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        return text;
    }

    async loadMarkdownFile(filename) {
        // 캐시 확인
        if (this.cache.has(filename)) {
            return this.cache.get(filename);
        }

        try {
            // 절대 경로를 시도해보고, 실패하면 상대 경로 시도
            let response;
            const paths = [
                `content/${filename}.md`,
                `./content/${filename}.md`,
                `/content/${filename}.md`
            ];

            for (const path of paths) {
                try {
                    response = await fetch(path);
                    if (response.ok) break;
                } catch (e) {
                    continue;
                }
            }

            if (!response || !response.ok) {
                // 모든 경로 실패 시 기본 내용 반환
                return this.getDefaultContent(filename);
            }

            const markdownContent = await response.text();
            const htmlContent = this.parseMarkdown(markdownContent);

            // 캐시에 저장
            this.cache.set(filename, htmlContent);

            return htmlContent;
        } catch (error) {
            return this.getDefaultContent(filename);
        }
    }

    getDefaultContent(filename) {
        const defaultMarkdown = {
            'portfolio': `# 포트폴리오

안녕하세요! 김동휘의 포트폴리오 페이지입니다.

## 주요 프로젝트

### 🚀 포트폴리오 웹사이트
**기술스택**: HTML, CSS, JavaScript, 마크다운  
**설명**: 대화형 포트폴리오 웹사이트 개발  
**주요 기능**:
* 타이핑 애니메이션
* 다크모드 지원
* 블로그 시스템
* 반응형 디자인

### 💻 프로젝트 2
**기술스택**: React, Node.js, MongoDB  
**설명**: 여기에 두 번째 프로젝트 설명을 입력하세요  

### 🔧 프로젝트 3
**기술스택**: Python, Django, PostgreSQL  
**설명**: 여기에 세 번째 프로젝트 설명을 입력하세요  

## 연락처

* **이메일**: kimdonghwi94@gmail.com
* **GitHub**: https://github.com/kimdonghwi94

---

*이 페이지는 GitHub에서 직접 편집할 수 있습니다.*`,
            
            'resume': `# 이력서

김동휘의 이력서입니다.

## 👤 기본 정보

* **이름**: 김동휘
* **이메일**: kimdonghwi94@gmail.com
* **깃허브**: https://github.com/kimdonghwi94

## 💼 경력

### 프론트엔드 개발자 (2022 - 현재)
* 웹 애플리케이션 개발
* React, Vue.js 사용
* 반응형 UI/UX 구현

## 🎓 학력

* **대학교**: 컴퓨터공학과 (2018-2022)`,
            
            'skills': `# 기술스택

## 💻 프로그래밍 언어

### ⭐⭐⭐⭐⭐ JavaScript
* **경험년수**: 3년
* **활용분야**: 웹 프론트엔드, 백엔드 개발
* **프레임워크**: React, Vue.js, Node.js

### ⭐⭐⭐⭐ Python
* **경험년수**: 2년
* **활용분야**: 데이터 분석, 백엔드 개발
* **프레임워크**: Django, FastAPI

### ⭐⭐⭐ Java
* **경험년수**: 1년
* **활용분야**: 객체지향 프로그래밍, 알고리즘
* **프레임워크**: Spring Boot

---

## 🎨 프론트엔드

### HTML/CSS
* **Semantic HTML** 작성
* **CSS Grid, Flexbox** 활용
* **반응형 웹 디자인**
* **CSS 애니메이션**

### JavaScript Frameworks
* **React**: 컴포넌트 기반 개발, Hook 활용
* **Vue.js**: 반응형 데이터 바인딩
* **Next.js**: SSR, SSG 구현

### CSS Frameworks
* **Tailwind CSS**: 유틸리티 우선 CSS
* **Bootstrap**: 빠른 프로토타이핑
* **Styled Components**: CSS-in-JS

---

## ⚙️ 백엔드

### Server Technologies
* **Node.js**: Express.js로 REST API 구축
* **Python**: Django, FastAPI
* **Database**: MySQL, PostgreSQL, MongoDB

### DevOps & Tools
* **Git/GitHub**: 버전 관리, 협업
* **Docker**: 컨테이너화
* **AWS**: EC2, S3 활용
* **Vercel/Netlify**: 정적 사이트 배포

---

## 📱 모바일 & 기타

### Mobile Development
* **React Native**: 크로스 플랫폼 앱 개발
* **PWA**: 프로그레시브 웹 앱

### Design & Collaboration
* **Figma**: UI/UX 디자인
* **Adobe XD**: 프로토타이핑
* **Notion**: 프로젝트 관리
* **Slack**: 팀 협업

---

## 📈 학습 계획

### 현재 학습 중
* TypeScript 심화 학습
* GraphQL & Apollo
* 클라우드 아키텍처 (AWS)

### 앞으로 배우고 싶은 기술
* Kubernetes
* 마이크로서비스 아키텍처
* AI/ML 기초

---

*기술스택은 지속적으로 업데이트됩니다.*`
        };
        
        const markdown = defaultMarkdown[filename] || `# ${filename.charAt(0).toUpperCase() + filename.slice(1)} 페이지\n\n아직 내용이 작성되지 않았습니다.`;
        return this.parseMarkdown(markdown);
    }

    async getPageContent(pageName) {
        let content = await this.loadMarkdownFile(pageName);
        return content;
    }

    // 캐시 무효화 (파일 수정 후 호출)
    invalidateCache(filename) {
        this.cache.delete(filename);
    }
}

// 전역 인스턴스
window.markdownLoader = new MarkdownLoader();
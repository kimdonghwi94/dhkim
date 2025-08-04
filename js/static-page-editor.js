class StaticPageEditor {
    constructor() {
        this.currentPage = null;
        this.originalContent = '';
    }

    async openEditor(pageName) {
        this.currentPage = pageName;
        
        try {
            // 원본 마크다운 파일 내용 로드
            const response = await fetch(`content/${pageName}.md`);
            this.originalContent = await response.text();
        } catch (error) {
            console.error('Error loading markdown file:', error);
            this.originalContent = `# ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}\n\n여기에 내용을 작성하세요.`;
        }

        const pageBody = document.getElementById('page-body');
        const pageTitle = this.getPageTitle(pageName);
        
        pageBody.innerHTML = `
            <div class="static-editor-container">
                <div class="static-editor-header">
                    <h2>${pageTitle} 편집</h2>
                    <div class="static-editor-actions">
                        <button class="preview-btn" onclick="toggleStaticPreview()">미리보기</button>
                        <button class="save-btn" onclick="saveStaticPage()">저장 (로컬)</button>
                        <button class="download-btn" onclick="downloadMarkdown()">다운로드</button>
                        <button class="cancel-btn" onclick="cancelStaticEdit()">취소</button>
                    </div>
                </div>
                
                <div class="static-editor-notice">
                    <div class="notice-content">
                        <strong>⚠️ 중요:</strong> 이 에디터는 로컬에서만 작동합니다. 
                        실제 GitHub Pages에 반영하려면 <strong>다운로드</strong> 버튼을 눌러 파일을 받은 후, 
                        GitHub 저장소의 <code>content/${pageName}.md</code> 파일을 직접 교체해주세요.
                    </div>
                </div>
                
                <div class="static-editor-wrapper">
                    <div class="static-editor-tabs">
                        <button class="tab-btn active" onclick="switchStaticTab('write')">작성</button>
                        <button class="tab-btn" onclick="switchStaticTab('preview')">미리보기</button>
                    </div>
                    
                    <div class="static-editor-content">
                        <textarea id="static-page-content" placeholder="마크다운으로 작성하세요..." 
                                  class="static-markdown-editor">${this.originalContent}</textarea>
                        <div id="static-preview-content" class="static-preview-content" style="display: none;"></div>
                    </div>
                </div>
                
                <div class="static-editor-help">
                    <details>
                        <summary>📖 마크다운 작성 도움말</summary>
                        <div class="help-content">
                            <h4>기본 문법:</h4>
                            <ul>
                                <li><code># 제목</code> - 큰 제목 (H1)</li>
                                <li><code>## 제목</code> - 중간 제목 (H2)</li>
                                <li><code>### 제목</code> - 작은 제목 (H3)</li>
                                <li><code>**굵게**</code> - <strong>굵은 텍스트</strong></li>
                                <li><code>*기울임*</code> - <em>기울어진 텍스트</em></li>
                                <li><code>\`코드\`</code> - <code>인라인 코드</code></li>
                                <li><code>* 항목</code> - 리스트 항목</li>
                                <li><code>[링크텍스트](URL)</code> - 링크</li>
                            </ul>
                        </div>
                    </details>
                </div>
            </div>
        `;
        
        // 실시간 미리보기를 위한 이벤트 리스너
        document.getElementById('static-page-content').addEventListener('input', this.updateStaticPreview.bind(this));
        
        // 초기 미리보기 업데이트
        this.updateStaticPreview();
    }

    getPageTitle(pageName) {
        const titles = {
            'portfolio': '포트폴리오',
            'resume': '이력서',
            'skills': '기술스택'
        };
        return titles[pageName] || pageName;
    }

    updateStaticPreview() {
        const content = document.getElementById('static-page-content').value;
        const previewContent = document.getElementById('static-preview-content');
        
        if (window.markdownLoader) {
            previewContent.innerHTML = window.markdownLoader.parseMarkdown(content);
        }
    }

    switchTab(tab) {
        const writeTabs = document.querySelectorAll('.static-editor-tabs .tab-btn');
        const editor = document.getElementById('static-page-content');
        const preview = document.getElementById('static-preview-content');
        
        writeTabs.forEach(btn => btn.classList.remove('active'));
        
        if (tab === 'write') {
            document.querySelector('.static-editor-tabs .tab-btn').classList.add('active');
            editor.style.display = 'block';
            preview.style.display = 'none';
        } else {
            document.querySelectorAll('.static-editor-tabs .tab-btn')[1].classList.add('active');
            editor.style.display = 'none';
            preview.style.display = 'block';
            this.updateStaticPreview();
        }
    }

    saveToLocal() {
        const content = document.getElementById('static-page-content').value;
        
        // 로컬 스토리지에 임시 저장
        localStorage.setItem(`static-page-${this.currentPage}`, content);
        
        // 캐시 무효화하여 즉시 반영
        if (window.markdownLoader) {
            window.markdownLoader.invalidateCache(this.currentPage);
        }
        
        alert('로컬에 저장되었습니다. 실제 반영을 위해서는 다운로드 후 GitHub에 업로드해주세요.');
        
        // 저장 후 해당 페이지로 이동
        navigateToPage(this.currentPage);
    }

    downloadMarkdown() {
        const content = document.getElementById('static-page-content').value;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentPage}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`${this.currentPage}.md 파일이 다운로드되었습니다.\nGitHub 저장소의 content 폴더에 업로드해주세요.`);
    }

    cancel() {
        if (confirm('편집 중인 내용이 사라집니다. 계속하시겠습니까?')) {
            navigateToPage(this.currentPage);
        }
    }

    // 로컬 스토리지에서 수정된 내용 로드
    async loadContent(pageName) {
        const localContent = localStorage.getItem(`static-page-${pageName}`);
        
        if (localContent) {
            // 로컬에 수정된 내용이 있으면 사용
            return window.markdownLoader.parseMarkdown(localContent);
        } else {
            // 없으면 파일에서 로드
            return await window.markdownLoader.loadMarkdownFile(pageName);
        }
    }
}

// 전역 인스턴스
window.staticPageEditor = new StaticPageEditor();

// 전역 함수들
function switchStaticTab(tab) {
    window.staticPageEditor.switchTab(tab);
}

function toggleStaticPreview() {
    const previewContent = document.getElementById('static-preview-content');
    const isVisible = previewContent.style.display !== 'none';
    switchStaticTab(isVisible ? 'write' : 'preview');
}

function saveStaticPage() {
    window.staticPageEditor.saveToLocal();
}

function downloadMarkdown() {
    window.staticPageEditor.downloadMarkdown();
}

function cancelStaticEdit() {
    window.staticPageEditor.cancel();
}
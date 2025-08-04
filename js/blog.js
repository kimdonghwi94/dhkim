class BlogManager {
    constructor() {
        this.currentPostId = null;
        this.isEditing = false;
        this.init();
    }

    init() {
        // 마크다운 파서 초기화 (간단한 구현)
        this.initMarkdownParser();
    }

    initMarkdownParser() {
        // 더 간단하고 안정적인 마크다운 파서
    }

    parseMarkdown(markdown) {
        if (!markdown) return '';
        
        let html = markdown;
        
        // 1. 코드 블록 처리 (먼저 처리해야 다른 규칙과 충돌 방지)
        html = html.replace(/```([^`]*?)```/g, '<pre><code>$1</code></pre>');
        
        // 2. 인라인 코드 처리
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 3. 헤더 처리
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // 4. 강조 처리
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // 5. 링크 처리
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // 6. 리스트 처리
        const lines = html.split('\n');
        const processedLines = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.match(/^\* (.+)/)) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push('<li>' + line.replace(/^\* /, '') + '</li>');
            } else {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push(line);
            }
        }
        
        if (inList) {
            processedLines.push('</ul>');
        }
        
        html = processedLines.join('\n');
        
        // 7. 줄바꿈 처리 (두 개의 연속된 줄바꿈은 문단으로, 하나는 br로)
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // 8. 문단 래핑
        if (html && !html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        }
        
        // 9. 빈 문단 제거
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '');
        
        return html;
    }

    createNewPost() {
        this.currentPostId = this.generateId();
        this.isEditing = false;
        this.openEditor();
    }

    editPost(postId) {
        this.currentPostId = postId;
        this.isEditing = true;
        const post = this.getPost(postId);
        this.openEditor(post);
    }

    openEditor(post = null) {
        const pageBody = document.getElementById('page-body');
        
        pageBody.innerHTML = `
            <div class="editor-container">
                <div class="editor-header">
                    <h2>${this.isEditing ? '글 편집' : '새 글 작성'}</h2>
                    <div class="editor-actions">
                        <button class="preview-btn" onclick="togglePreview()">미리보기</button>
                        <button class="save-btn" onclick="savePost()">저장</button>
                        <button class="cancel-btn" onclick="cancelEdit()">취소</button>
                    </div>
                </div>
                
                <div class="editor-form">
                    <input type="text" id="post-title" placeholder="제목을 입력하세요" 
                           value="${post ? post.title : ''}" class="title-input">
                    
                    <input type="text" id="post-tags" placeholder="태그를 쉼표로 구분하여 입력하세요 (예: JavaScript, React, CSS)" 
                           value="${post ? post.tags.join(', ') : ''}" class="tags-input">
                    
                    <div class="editor-wrapper">
                        <div class="editor-tabs">
                            <button class="tab-btn active" onclick="switchTab('write')">작성</button>
                            <button class="tab-btn" onclick="switchTab('preview')">미리보기</button>
                        </div>
                        
                        <div class="editor-content">
                            <textarea id="post-content" placeholder="마크다운으로 작성하세요..." 
                                      class="markdown-editor">${post ? post.content : ''}</textarea>
                            <div id="preview-content" class="preview-content" style="display: none;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 실시간 미리보기를 위한 이벤트 리스너
        document.getElementById('post-content').addEventListener('input', this.updatePreview.bind(this));
    }

    updatePreview() {
        const content = document.getElementById('post-content').value;
        const previewContent = document.getElementById('preview-content');
        previewContent.innerHTML = this.parseMarkdown(content);
    }

    switchTab(tab) {
        const writeTabs = document.querySelectorAll('.tab-btn');
        const editor = document.getElementById('post-content');
        const preview = document.getElementById('preview-content');
        
        writeTabs.forEach(btn => btn.classList.remove('active'));
        
        if (tab === 'write') {
            document.querySelector('.tab-btn').classList.add('active');
            editor.style.display = 'block';
            preview.style.display = 'none';
        } else {
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
            editor.style.display = 'none';
            preview.style.display = 'block';
            this.updatePreview();
        }
    }

    savePost() {
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const tagsInput = document.getElementById('post-tags').value.trim();
        
        if (!title || !content) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }
        
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        // Excerpt 생성 - 마크다운을 HTML로 변환 후 텍스트만 추출
        let excerptText = content.substring(0, 200);
        // 마크다운 문법 제거
        excerptText = excerptText.replace(/#{1,3}\s/g, ''); // 헤더 제거
        excerptText = excerptText.replace(/\*\*(.*?)\*\*/g, '$1'); // 굵게 제거
        excerptText = excerptText.replace(/\*(.*?)\*/g, '$1'); // 기울임 제거
        excerptText = excerptText.replace(/`(.*?)`/g, '$1'); // 인라인 코드 제거
        excerptText = excerptText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // 링크 제거
        excerptText = excerptText.replace(/^\* /gm, '• '); // 리스트 마커 변경
        excerptText = excerptText.replace(/\n/g, ' '); // 줄바꿈을 공백으로
        
        const excerpt = excerptText.substring(0, 150) + (excerptText.length > 150 ? '...' : '');
        
        const post = {
            id: this.currentPostId,
            title,
            content,
            tags,
            excerpt,
            createdAt: this.isEditing ? this.getPost(this.currentPostId).createdAt : Date.now(),
            updatedAt: Date.now()
        };
        
        this.storePost(post);
        
        // 블로그 목록으로 돌아가기
        navigateToPage('blog');
        
        alert(this.isEditing ? '글이 수정되었습니다.' : '새 글이 작성되었습니다.');
    }

    cancelEdit() {
        if (confirm('작성 중인 내용이 사라집니다. 계속하시겠습니까?')) {
            navigateToPage('blog');
        }
    }

    deletePost(postId) {
        if (confirm('정말로 이 글을 삭제하시겠습니까?')) {
            const posts = this.getStoredPosts();
            const updatedPosts = posts.filter(post => post.id !== postId);
            localStorage.setItem('blog-posts', JSON.stringify(updatedPosts));
            
            // 페이지 새로고침
            navigateToPage('blog');
            alert('글이 삭제되었습니다.');
        }
    }

    viewPost(postId) {
        const post = this.getPost(postId);
        if (!post) return;
        
        const pageBody = document.getElementById('page-body');
        
        pageBody.innerHTML = `
            <div class="post-viewer">
                <div class="post-header">
                    <button class="back-to-list-btn" onclick="navigateToPage('blog')">← 목록으로</button>
                    <div class="post-actions">
                        <button onclick="editPost('${post.id}')" class="edit-btn">편집</button>
                        <button onclick="deletePost('${post.id}')" class="delete-btn">삭제</button>
                    </div>
                </div>
                
                <article class="post-content">
                    <h1 class="post-title">${post.title}</h1>
                    <div class="post-meta">
                        <span class="post-date">작성일: ${new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                        ${post.updatedAt !== post.createdAt ? 
                            `<span class="post-updated">수정일: ${new Date(post.updatedAt).toLocaleDateString('ko-KR')}</span>` : ''}
                    </div>
                    <div class="post-tags">
                        ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <div class="post-body">
                        ${this.parseMarkdown(post.content)}
                    </div>
                </article>
            </div>
        `;
    }

    getPost(postId) {
        const posts = this.getStoredPosts();
        return posts.find(post => post.id === postId);
    }

    storePost(post) {
        const posts = this.getStoredPosts();
        const existingIndex = posts.findIndex(p => p.id === post.id);
        
        if (existingIndex >= 0) {
            posts[existingIndex] = post;
        } else {
            posts.unshift(post); // 최신 글이 위로
        }
        
        localStorage.setItem('blog-posts', JSON.stringify(posts));
    }

    getStoredPosts() {
        try {
            return JSON.parse(localStorage.getItem('blog-posts') || '[]');
        } catch (e) {
            return [];
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
}

// 전역 블로그 매니저 인스턴스
window.blogManager = new BlogManager();
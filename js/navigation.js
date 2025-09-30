class NavigationSystem {
    constructor() {
        this.currentPage = 'home';
        this.pages = {
            'portfolio': {
                title: '포트폴리오',
                isMarkdown: true
            },
            'resume': {
                title: '이력서',
                isMarkdown: true
            },
            'skills': {
                title: '기술스택',
                isMarkdown: true
            },
            'blog': {
                title: '블로그',
                isMarkdown: false // 동적으로 로드됨
            }
        };
    }

    navigateToPage(pageName) {
        if (!this.pages[pageName]) {
            console.error(`페이지 '${pageName}'을 찾을 수 없습니다.`);
            return;
        }

        this.currentPage = pageName;
        
        // 메인 컨테이너 숨기기
        const mainContainer = document.querySelector('.container');
        const pageContent = document.getElementById('page-content');
        const pageBody = document.getElementById('page-body');
        const chatContainer = document.getElementById('chat-container');

        // 페이지 전환 애니메이션
        mainContainer.style.transition = 'opacity 0.3s ease';
        mainContainer.style.opacity = '0';

        setTimeout(async () => {
            mainContainer.style.display = 'none';
            
            // 페이지 콘텐츠 설정
            if (pageName === 'blog') {
                // 블로그 페이지는 동적으로 콘텐츠 생성
                pageBody.innerHTML = this.getBlogContent();
            } else if (this.pages[pageName].isMarkdown) {
                // 마크다운 페이지는 마크다운 로더 사용 (관리자 버튼 포함)
                if (window.markdownLoader) {
                    console.log(`네비게이션: ${pageName} 페이지 로드 중...`);
                    pageBody.innerHTML = await window.markdownLoader.getPageContent(pageName);
                } else {
                    pageBody.innerHTML = `<h1>로딩 중...</h1><p>마크다운 로더를 불러오는 중입니다.</p>`;
                }
            } else {
                pageBody.innerHTML = '<h1>페이지를 찾을 수 없습니다.</h1>';
            }
            
            document.title = `${this.pages[pageName].title} - 김동휘 웹 페이지`;
            
            // 페이지 콘텐츠 표시
            pageContent.style.display = 'block';
            pageContent.style.opacity = '0';
            pageContent.style.transition = 'opacity 0.3s ease';
            
            // 연결된 Agent 창 숨기기
            const proxyStatus = document.getElementById('proxy-status');
            if (proxyStatus) {
                proxyStatus.style.display = 'none';
            }
            
            setTimeout(() => {
                pageContent.style.opacity = '1';
                // 플로팅 버튼 표시 (메인 페이지가 아닐 때만)
                const chatFloatBtn = document.getElementById('chat-float-btn');
                chatFloatBtn.style.display = 'flex';
                
                // 세션 컨텍스트 업데이트
                if (window.sessionManager) {
                    window.sessionManager.setCurrentContext({
                        page: pageName,
                        pageTitle: this.pages[pageName].title,
                        navigationTime: Date.now()
                    });
                    
                    // 채팅 히스토리 동기화
                    window.sessionManager.syncToFloatingChat();
                }
            }, 50);
        }, 300);
    }

    goHome() {
        this.currentPage = 'home';

        const mainContainer = document.querySelector('.container');
        const pageContent = document.getElementById('page-content');
        const chatContainer = document.getElementById('chat-container');

        // 페이지 콘텐츠 숨기기
        pageContent.style.transition = 'opacity 0.3s ease';
        pageContent.style.opacity = '0';

        setTimeout(() => {
            pageContent.style.display = 'none';
            chatContainer.style.display = 'none'; // 채팅창 숨기기
            chatContainer.classList.remove('active'); // 활성 클래스 제거

            // 플로팅 버튼도 숨기기 (메인 페이지에서는 플로팅 버튼도 숨김)
            const chatFloatBtn = document.getElementById('chat-float-btn');
            chatFloatBtn.style.display = 'none';

            // 메인 페이지 표시
            mainContainer.style.display = 'flex';
            mainContainer.style.opacity = '0';

            // 연결된 Agent 창 다시 표시
            const proxyStatus = document.getElementById('proxy-status');
            if (proxyStatus) {
                proxyStatus.style.display = 'flex';
            }

            setTimeout(() => {
                mainContainer.style.opacity = '1';
                document.title = '김동휘 웹 페이지';

                // 세션 컨텍스트 업데이트
                if (window.sessionManager) {
                    window.sessionManager.setCurrentContext({
                        page: 'home',
                        navigationTime: Date.now()
                    });
                }

                // 메인 페이지 채팅 기능 재초기화
                if (window.portfolioApp) {
                    console.log('메인 페이지 채팅 기능 재초기화 시작');

                    // 먼저 세션 기록을 복원
                    if (window.sessionManager) {
                        const allMessages = window.sessionManager.getChatHistory();
                        console.log('복원할 메시지 수:', allMessages.length);
                        if (allMessages.length > 0) {
                            window.portfolioApp.restoreChatHistory(allMessages);
                        }
                    }

                    // 채팅 기능 재초기화
                    window.portfolioApp.reinitializeChat();

                    // 승인 시스템 재초기화
                    if (!window.approvalSystem) {
                        console.log('승인 시스템 재생성');
                        window.approvalSystem = new ApprovalSystem();
                    } else {
                        console.log('승인 시스템이 이미 존재함');
                    }

                    console.log('메인 페이지 채팅 기능 재초기화 완료');
                } else {
                    console.error('portfolioApp이 존재하지 않습니다');
                }
            }, 50);
        }, 300);
    }

    getBlogContent() {
        return `
            <div class="blog-container">
                <div class="blog-header">
                    <h1>블로그</h1>
                    <button class="new-post-btn" onclick="createNewPost()">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                        </svg>
                        새 글 작성
                    </button>
                </div>
                <div class="blog-posts" id="blog-posts">
                    ${this.getBlogPosts()}
                </div>
            </div>
        `;
    }

    getBlogPosts() {
        const posts = this.getStoredPosts();
        
        if (!posts || posts.length === 0) {
            return `
                <div class="empty-state">
                    <h3>아직 작성된 글이 없습니다</h3>
                    <p>첫 번째 기술 블로그 글을 작성해보세요!</p>
                </div>
            `;
        }

        return posts.map(post => {
            // 미리보기용 마크다운 파싱 (간단 버전)
            let previewContent = post.content.substring(0, 200);
            
            // 마크다운을 HTML로 변환
            previewContent = previewContent.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            previewContent = previewContent.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            previewContent = previewContent.replace(/^# (.+)$/gm, '<h1>$1</h1>');
            previewContent = previewContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            previewContent = previewContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            previewContent = previewContent.replace(/`([^`]+)`/g, '<code>$1</code>');
            previewContent = previewContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
            previewContent = previewContent.replace(/^\* (.+)$/gm, '• $1');
            previewContent = previewContent.replace(/\n/g, '<br>');
            
            // 200자 이후 잘라내기
            if (post.content.length > 200) {
                previewContent += '...';
            }
            
            return `
                <article class="blog-post" onclick="viewPost('${post.id}')">
                    <div class="post-meta">
                        <span class="post-date">${new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                        <div class="post-actions">
                            <button onclick="editPost('${post.id}'); event.stopPropagation();" class="edit-btn">편집</button>
                            <button onclick="deletePost('${post.id}'); event.stopPropagation();" class="delete-btn">삭제</button>
                        </div>
                    </div>
                    <h2 class="post-title">${post.title}</h2>
                    <div class="post-excerpt">${previewContent}</div>
                    <div class="post-tags">
                        ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </article>
            `;
        }).join('');
    }

    getStoredPosts() {
        try {
            return JSON.parse(localStorage.getItem('blog-posts') || '[]');
        } catch (e) {
            return [];
        }
    }
}

// 전역 네비게이션 인스턴스
const navigation = new NavigationSystem();

// 전역 함수들
function navigateToPage(pageName) {
    navigation.navigateToPage(pageName);
}

function goHome() {
    navigation.goHome();
}

// 블로그 관련 전역 함수들
async function createNewPost() {
    if (window.blogManager) {
        await window.blogManager.createNewPost();
    }
}

function editPost(postId) {
    if (window.blogManager) {
        window.blogManager.editPost(postId);
    }
}

function deletePost(postId) {
    if (window.blogManager) {
        window.blogManager.deletePost(postId);
    }
}

function viewPost(postId) {
    if (window.blogManager) {
        window.blogManager.viewPost(postId);
    }
}

function savePost() {
    if (window.blogManager) {
        window.blogManager.savePost();
    }
}

function cancelEdit() {
    if (window.blogManager) {
        window.blogManager.cancelEdit();
    }
}

function switchTab(tab) {
    if (window.blogManager) {
        window.blogManager.switchTab(tab);
    }
}

function togglePreview() {
    const previewContent = document.getElementById('preview-content');
    if (previewContent) {
        const isVisible = previewContent.style.display !== 'none';
        switchTab(isVisible ? 'write' : 'preview');
    }
}
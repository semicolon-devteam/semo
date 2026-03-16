/**
 * 정치판 GA4 이벤트 트래킹 유틸리티
 * 
 * 사용법:
 * 1. 이 파일을 정치판 프론트엔드에 포함
 * 2. GA4_TRACKING_ID를 실제 측정 ID로 교체
 * 3. 각 이벤트 함수 호출
 */

const GA4_TRACKING_ID = 'G-XXXXXXXXXX'; // 실제 GA4 측정 ID로 교체

// GA4 초기화 (이미 gtag.js가 로드되어 있다고 가정)
function initGA4() {
  if (typeof gtag === 'undefined') {
    console.error('gtag.js가 로드되지 않았습니다.');
    return;
  }
  
  // 로그인 상태 확인 및 설정
  const isLoggedIn = checkUserLoginStatus();
  
  if (isLoggedIn) {
    const userId = getCurrentUserId();
    setUserLoginStatus(userId);
  } else {
    setUserGuestStatus();
  }
}

// 로그인 상태 확인 (실제 구현 필요)
function checkUserLoginStatus() {
  // 쿠키, 세션 스토리지, localStorage 등에서 확인
  // 예시:
  return localStorage.getItem('isLoggedIn') === 'true';
}

// 현재 사용자 ID 가져오기 (실제 구현 필요)
function getCurrentUserId() {
  // 익명화된 사용자 ID 반환 (해시값 등)
  return localStorage.getItem('userId') || null;
}

// 로그인 사용자 설정
function setUserLoginStatus(userId) {
  gtag('config', GA4_TRACKING_ID, {
    'user_id': userId,
  });
  
  gtag('set', 'user_properties', {
    'user_login_status': 'logged_in',
    'user_type': 'member'
  });
}

// 게스트 사용자 설정
function setUserGuestStatus() {
  gtag('set', 'user_properties', {
    'user_login_status': 'guest',
    'user_type': 'guest'
  });
}

// ========== 이벤트 트래킹 함수들 ==========

/**
 * 투표 이벤트
 */
function trackVote(debateId, optionId, isAnonymous = false) {
  gtag('event', 'vote', {
    'debate_id': String(debateId),
    'option_id': String(optionId),
    'is_anonymous': isAnonymous,
    'event_category': 'engagement',
    'event_label': 'debate_vote'
  });
  
  console.log('[GA4] Vote tracked:', { debateId, optionId, isAnonymous });
}

/**
 * 댓글 작성 이벤트
 */
function trackComment(debateId, commentLength, isAnonymous = false) {
  gtag('event', 'comment', {
    'debate_id': String(debateId),
    'comment_length': commentLength,
    'is_anonymous': isAnonymous,
    'event_category': 'engagement',
    'event_label': 'debate_comment'
  });
  
  console.log('[GA4] Comment tracked:', { debateId, commentLength, isAnonymous });
}

/**
 * 게시글 작성 이벤트
 */
function trackPostCreate(postType, titleLength) {
  gtag('event', 'post_create', {
    'post_type': postType, // 'debate', 'poll', 'discussion'
    'title_length': titleLength,
    'event_category': 'engagement',
    'event_label': 'create_debate'
  });
  
  console.log('[GA4] Post create tracked:', { postType, titleLength });
}

/**
 * 토론 참여 이벤트 (10초 이상 체류)
 */
function trackDebateEngagement(debateId) {
  const startTime = Date.now();
  
  const trackOnLeave = () => {
    const duration = (Date.now() - startTime) / 1000;
    
    if (duration > 10) {
      gtag('event', 'debate_join', {
        'debate_id': String(debateId),
        'duration_seconds': Math.floor(duration),
        'event_category': 'engagement',
        'event_label': 'read_debate'
      });
      
      console.log('[GA4] Debate engagement tracked:', { debateId, duration });
    }
  };
  
  window.addEventListener('beforeunload', trackOnLeave);
  
  // SPA 라우팅 변경 감지 (Vue Router, React Router 등)
  // 예시: Vue Router
  if (window.$router) {
    window.$router.beforeEach((to, from, next) => {
      trackOnLeave();
      next();
    });
  }
}

/**
 * 로그인 이벤트
 */
function trackLogin(userId, method = 'email') {
  setUserLoginStatus(userId);
  
  gtag('event', 'login', {
    'method': method, // 'email', 'social', 'google', etc.
    'event_category': 'user',
    'event_label': 'user_login'
  });
  
  console.log('[GA4] Login tracked:', { userId, method });
}

/**
 * 로그아웃 이벤트
 */
function trackLogout() {
  gtag('event', 'logout', {
    'event_category': 'user',
    'event_label': 'user_logout'
  });
  
  setUserGuestStatus();
  
  console.log('[GA4] Logout tracked');
}

/**
 * 회원가입 이벤트
 */
function trackSignup(userId, method = 'email') {
  setUserLoginStatus(userId);
  
  gtag('event', 'sign_up', {
    'method': method,
    'event_category': 'user',
    'event_label': 'user_signup'
  });
  
  console.log('[GA4] Signup tracked:', { userId, method });
}

// ========== 자동 초기화 ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGA4);
} else {
  initGA4();
}

// Export (ES6 모듈 사용 시)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    trackVote,
    trackComment,
    trackPostCreate,
    trackDebateEngagement,
    trackLogin,
    trackLogout,
    trackSignup,
  };
}

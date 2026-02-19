
// Supabase 설정
const SUPABASE_URL = 'https://imtdijfseaninhvjoklp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fY0K_-WP3PyG5ihvxgCPSw_bYewHmnR';

// Supabase 클라이언트 생성
let supabase;
if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else if (typeof supabase !== 'undefined') {
    // 이미 로드된 경우 (global namespace)
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// 로그인 상태 확인 및 리다이렉트 처리 (보호된 페이지용)
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // 로그인되지 않은 경우 로그인 페이지로 이동
        window.location.href = 'login.html';
    }
    return session;
}

// 로그아웃 함수
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('로그아웃 중 오류가 발생했습니다: ' + error.message);
    } else {
        alert('로그아웃 되었습니다.');
        window.location.href = 'login.html';
    }
}

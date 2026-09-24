'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, LogIn, Phone, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { studentAuthApi } from '@/lib/api';

export default function StudentLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage.setItem failed (Safari Private Mode?):', e);
    }
    try {
      sessionStorage.setItem(key, value);
    } catch (_) {}
    try {
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax`;
    } catch (_) {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Làm sạch khoảng trắng do bàn phím điện thoại tự động thêm vào
    const cleanPhone = phone.trim().replace(/[\s\.\-\(\)]/g, '');
    const cleanPassword = password.trim();

    try {
      const res = await studentAuthApi.login({ phone: cleanPhone, password: cleanPassword });
      if (res.data && res.data.token) {
        // Lưu token và thông tin user an toàn cho cả Safari chế độ ẩn danh
        safeSetItem('student_token', res.data.token);
        safeSetItem('student_user', JSON.stringify(res.data.user));
        
        // Chuyển hướng đến Dashboard học viên
        router.push('/student/dashboard');
      }
    } catch (err: any) {
      console.error('Student login error:', err);
      const serverMsg = err.response?.data?.error;
      const clientMsg = err.message;
      setError(serverMsg || clientMsg || 'Số điện thoại hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 20 }}>
      <div className="glass-card animate-fadeInUp" style={{ width: '100%', maxWidth: 430, padding: '36px 32px', borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'var(--accent-blue)', color: 'white', marginBottom: 16 }}>
            <GraduationCap size={36} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>Cổng Học Viên</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Đăng nhập để xem lịch học và điểm danh</p>
          <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', background: 'rgba(0,122,255,0.08)', borderRadius: 12, fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
            Hỗ trợ Safari iOS & Android
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: 'rgba(255, 59, 48, 0.1)', color: 'var(--accent-red)', borderRadius: 12, marginBottom: 20, fontSize: 14 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ wordBreak: 'break-word' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>Số điện thoại</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }}>
                <Phone size={18} />
              </div>
              <input 
                type="tel" 
                className="form-input" 
                style={{ paddingLeft: 42 }}
                placeholder="Nhập số điện thoại của bạn"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Mật khẩu</label>
              {/* Nút bấm Hiện/Ẩn mật khẩu to rõ ràng, không bị che bởi bàn phím hay Safari Keychain */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue, #007aff)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 4px'
                }}
              >
                {showPassword ? <><EyeOff size={15} /> Ẩn mật khẩu</> : <><Eye size={15} /> Bấm để xem mật khẩu</>}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }}>
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                style={{ paddingLeft: 42, paddingRight: 46 }}
                placeholder="Nhập mật khẩu (NhanPhu2026)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: showPassword ? 'var(--accent-blue, #007aff)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 6,
                  zIndex: 10
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {/* Hộp gợi ý & nút tự động điền mật khẩu 1 chạm cho điện thoại */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              flexWrap: 'wrap',
              gap: 8,
              background: 'rgba(0, 122, 255, 0.06)',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(0, 122, 255, 0.15)'
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Mặc định: <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>NhanPhu2026</strong>
              </span>
              <button 
                type="button"
                onClick={() => {
                  setPassword('NhanPhu2026');
                  setShowPassword(true);
                }}
                style={{
                  fontSize: 12,
                  color: '#ffffff',
                  background: 'var(--accent-blue, #007aff)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                ⚡ Tự điền mật khẩu
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16, marginTop: 4, fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span> : <><LogIn size={20} /> Đăng nhập</>}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          💡 <em>Trên Safari iPhone: Nếu chưa thấy nút mới, vui lòng bấm nút Tải lại trang (mũi tên xoay vòng) trên thanh địa chỉ.</em>
        </p>
      </div>
    </div>
  );
}

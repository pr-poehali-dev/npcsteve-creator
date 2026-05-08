import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

type Section = "studio" | "editor" | "gallery" | "billing" | "profile" | "admin";

const API = {
  generateImage: "https://functions.poehali.dev/bbac58dc-6753-4023-8a35-c179d54bc885",
  auth: "https://functions.poehali.dev/3920ee9e-4cd2-4680-9249-1d957bea13a5",
  admin: "https://functions.poehali.dev/a99ffa6e-6a99-4c20-83f9-e9e41a7f671c",
};

/* ─── USER CONTEXT ─── */
type User = {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  totp_enabled: boolean;
};

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const r = await fetch(API.auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body: JSON.stringify({ action: 'me' }),
      });
      if (!r.ok) { setUser(null); }
      else setUser(await r.json());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('balance-changed', handler);
    return () => window.removeEventListener('balance-changed', handler);
  }, [refresh]);

  const logout = useCallback(() => {
    const token = localStorage.getItem('session_token');
    if (token) {
      fetch(API.auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body: JSON.stringify({ action: 'logout' }),
      }).catch(() => {});
    }
    localStorage.removeItem('session_token');
    setUser(null);
  }, []);

  return { user, loading, setUser, logout, refresh };
}

/* ─── MOCK DATA ─── */
const galleryItems = [
  { id: 1, type: "image", label: "Портрет", prompt: "Неоновый портрет, киберпанк стиль", time: "2с" },
  { id: 2, type: "video", label: "Продакшн", prompt: "Анимация логотипа с частицами", time: "18с" },
  { id: 3, type: "text", label: "Копирайт", prompt: "Рекламный текст для стартапа", time: "1с" },
  { id: 4, type: "image", label: "Пейзаж", prompt: "Футуристический город на закате", time: "3с" },
  { id: 5, type: "video", label: "Reels", prompt: "Динамичный монтаж модного контента", time: "24с" },
  { id: 6, type: "image", label: "Продукт", prompt: "Съёмка духов, студийный свет", time: "2с" },
];

const plans = [
  { name: "Старт", price: "990", period: "мес", features: ["500 генераций", "HD качество", "Базовый редактор"], color: "cyan", popular: false },
  { name: "Про", price: "2 990", period: "мес", features: ["∞ генераций", "4K качество", "Движение камеры", "Массовая обработка"], color: "violet", popular: true },
  { name: "Студия", price: "9 990", period: "мес", features: ["Всё из Про", "API доступ", "Белый лейбл", "Приоритет"], color: "pink", popular: false },
];

const typeMap: Record<string, { icon: string; color: string }> = {
  image: { icon: "Image", color: "text-neon-cyan" },
  video: { icon: "Film", color: "text-neon-violet" },
  text: { icon: "FileText", color: "text-neon-pink" },
};

/* ─── BACKGROUND GRID ─── */
function GridBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #b24bff 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #00f5ff 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full opacity-5 -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, #ff2d9b 0%, transparent 70%)', filter: 'blur(40px)' }} />
    </div>
  );
}

/* ─── AUTH MODAL ─── */
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [step, setStep] = useState<'creds' | '2fa'>('creds');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (step === '2fa') {
      if (!/^\d{6}$/.test(code)) { setError('Введите 6 цифр из приложения'); return; }
      setBusy(true);
      try {
        const r = await fetch(API.auth, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login-2fa', pending_token: pendingToken, code: code.trim() }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Ошибка входа');
        localStorage.setItem('session_token', data.session_token);
        onSuccess(data.user);
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !email.includes('@')) { setError('Введите корректный email'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }

    setBusy(true);
    try {
      const r = await fetch(API.auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'register' ? 'register' : 'login',
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      if (data.requires_2fa) {
        setPendingToken(data.pending_token);
        setStep('2fa');
        return;
      }
      localStorage.setItem('session_token', data.session_token);
      onSuccess(data.user);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm mx-4 p-8 rounded-2xl relative animate-scale-in"
        style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
        onClick={e => e.stopPropagation()}>

        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
          <Icon name="X" size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.15), rgba(178,75,255,0.15))', border: '1px solid rgba(0,245,255,0.2)' }}>
            <Icon name={step === '2fa' ? 'ShieldCheck' : 'Sparkles'} size={28} className="text-neon-cyan" />
          </div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
            {step === '2fa' ? 'Код из приложения' : (mode === 'login' ? 'Вход в LUMIX AI' : 'Регистрация')}
          </h2>
          <p className="font-body text-sm text-muted-foreground mt-2">
            {step === '2fa' ? 'Откройте Google Authenticator и введите 6 цифр' : 'Email и пароль — без СМС'}
          </p>
        </div>

        {step === 'creds' && (
          <div className="flex gap-1 p-1 mb-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-lg text-xs font-body font-semibold transition-all"
                style={mode === m
                  ? { background: 'linear-gradient(135deg, #00f5ff, #b24bff)', color: 'black' }
                  : { color: '#888' }}>
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {step === 'creds' && (
            <>
              <div className="relative">
                <Icon name="Mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl font-body text-sm outline-none transition-all placeholder:text-muted-foreground"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }}
                  autoFocus
                />
              </div>
              <div className="relative">
                <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="Пароль (мин. 6 символов)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl font-body text-sm outline-none transition-all placeholder:text-muted-foreground"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }}
                />
              </div>
            </>
          )}

          {step === '2fa' && (
            <div className="relative">
              <Icon name="KeyRound" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="000000"
                className="w-full pl-10 pr-4 py-3 rounded-xl font-display text-center text-xl tracking-[0.5em] outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-body text-neon-pink flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />
              {error}
            </p>
          )}

          <button onClick={submit} disabled={busy}
            className="w-full py-3.5 rounded-xl font-body font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)', color: 'black' }}>
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                Подождите...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Icon name={step === '2fa' ? 'ShieldCheck' : (mode === 'login' ? 'LogIn' : 'UserPlus')} size={16} />
                {step === '2fa' ? 'Подтвердить' : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
              </span>
            )}
          </button>

          {step === '2fa' && (
            <button onClick={() => { setStep('creds'); setCode(''); setError(''); }}
              className="w-full text-xs font-body text-muted-foreground hover:text-white transition-colors">
              ← Назад
            </button>
          )}
        </div>

        <p className="text-center text-xs font-body text-muted-foreground mt-5">
          Регистрируясь, вы принимаете условия использования
        </p>
      </div>
    </div>
  );
}

/* ─── NAVBAR ─── */
function Navbar({
  active, setActive, user, onLoginClick, onLogout
}: {
  active: Section;
  setActive: (s: Section) => void;
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "glass border-b border-dark-border" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)' }}>
            <span className="text-xs font-display font-bold text-black">LX</span>
          </div>
          <span className="font-display font-bold text-lg tracking-widest text-white">LUMIX<span className="gradient-text">AI</span></span>
        </div>

        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,30,46,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(["studio", "editor", "gallery", "billing"] as Section[]).map((s) => {
            const labels: Record<Section, string> = { studio: "Студия", editor: "Редактор", gallery: "Галерея", billing: "Биллинг" };
            return (
              <button key={s} onClick={() => setActive(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-body font-medium transition-all duration-300 ${active === s ? "text-black" : "text-muted-foreground hover:text-white"}`}
                style={active === s ? { background: 'linear-gradient(135deg, #00f5ff, #b24bff)' } : {}}>
                {labels[s]}
              </button>
            );
          })}
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            {/* Balance pill */}
            <button onClick={() => setActive('profile')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-all hover:scale-105"
              style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00f5ff' }}>
              <Icon name="Sparkles" size={12} />
              {user.balance}
            </button>
            <div className="relative">
              <button onClick={() => setUserMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                style={{ background: 'rgba(30,30,46,0.8)', border: '1px solid var(--dark-border)' }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                  : <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black"
                      style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)' }}>
                      {user.name?.[0] || '?'}
                    </div>
                }
                <span className="text-sm font-body text-white hidden sm:block">{user.name?.split(' ')[0]}</span>
                <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden shadow-2xl z-50 animate-scale-in"
                  style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--dark-border)' }}>
                    <p className="font-body font-semibold text-white text-sm truncate">{user.name}</p>
                    <p className="font-body text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs font-body" style={{ color: '#00f5ff' }}>
                      <Icon name="Sparkles" size={12} />
                      <span>{user.balance} генераций</span>
                    </div>
                  </div>
                  <button onClick={() => { setActive('profile'); setUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                    <Icon name="User" size={14} />
                    Профиль
                  </button>
                  {user.is_admin && (
                    <button onClick={() => { setActive('admin'); setUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                      <Icon name="ShieldAlert" size={14} className="text-neon-pink" />
                      Админ-панель
                    </button>
                  )}
                  <div className="h-px" style={{ background: 'var(--dark-border)' }} />
                  <button onClick={() => { onLogout(); setUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-body text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                    <Icon name="LogOut" size={14} />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button onClick={onLoginClick}
            className="px-4 py-2 rounded-lg text-sm font-body font-semibold text-black transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)' }}>
            Войти
          </button>
        )}
      </div>
    </nav>
  );
}

/* ─── TICKER ─── */
function Ticker() {
  const items = ["Фото", "Видео", "Текст", "Массовая обработка", "Движение камеры", "4K", "ИИ генерация", "API", "Batch режим"];
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden py-3 border-y" style={{ borderColor: 'var(--dark-border)', background: 'rgba(0,245,255,0.02)' }}>
      <div className="flex gap-12 animate-ticker whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="text-xs font-display font-medium tracking-widest uppercase flex items-center gap-3">
            <span className="w-1 h-1 rounded-full bg-neon-cyan inline-block" />
            <span className="text-muted-foreground">{item}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── TEXT-TO-IMAGE BLOCK ─── */
type GenResult = { id?: number; image_url: string; prompt: string };

function TextToImage({ user, onLoginRequired }: { user: User | null; onLoginRequired: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState("");
  const [imgSize, setImgSize] = useState("square_hd");

  const sizes = [
    { id: "square_hd", label: "1:1 HD" },
    { id: "landscape_4_3", label: "4:3" },
    { id: "portrait_4_3", label: "3:4" },
  ];

  const suggestions = [
    "Портрет девушки в стиле киберпанк, неоновые огни",
    "Футуристический город на закате, 8K фото",
    "Минималистичный логотип на тёмном фоне",
    "Космический пейзаж с планетами и туманностями",
  ];

  async function generate() {
    if (!prompt.trim()) return;
    if (!user) { onLoginRequired(); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const token = localStorage.getItem('session_token') || '';
      const r = await fetch(API.generateImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body: JSON.stringify({ prompt, image_size: imgSize }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка генерации');
      setResult(data);
      window.dispatchEvent(new CustomEvent('balance-changed'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'var(--dark-border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <Icon name="Wand2" size={16} className="text-neon-cyan" />
        </div>
        <div>
          <p className="font-display font-bold text-sm uppercase tracking-wider text-white">Text → Image</p>
          <p className="font-body text-xs text-muted-foreground">FLUX Schnell — до 4 секунд</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" />
          <span className="text-xs font-body text-neon-cyan">Live</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Size selector */}
        <div className="flex gap-2">
          {sizes.map(s => (
            <button key={s.id} onClick={() => setImgSize(s.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-all"
              style={imgSize === s.id
                ? { background: 'rgba(0,245,255,0.15)', border: '1px solid rgba(0,245,255,0.4)', color: '#00f5ff' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: '#888' }
              }>
              {s.label}
            </button>
          ))}
        </div>

        {/* Prompt area */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); }}
            placeholder="Опишите изображение на любом языке..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl font-body text-sm placeholder:text-muted-foreground resize-none outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--dark-border)', color: 'white' }}
          />
          <span className="absolute bottom-3 right-3 text-xs font-body text-muted-foreground">Ctrl+Enter</span>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setPrompt(s)}
              className="text-xs font-body px-2.5 py-1 rounded-lg transition-all hover:scale-105 text-left"
              style={{ background: 'rgba(178,75,255,0.06)', border: '1px solid rgba(178,75,255,0.15)', color: '#b24bff' }}>
              {s.length > 30 ? s.slice(0, 30) + '…' : s}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="w-full py-3 rounded-xl font-display font-bold uppercase tracking-widest text-sm transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: loading || !prompt.trim() ? 'var(--dark-border)' : 'linear-gradient(135deg, #00f5ff, #b24bff)', color: loading || !prompt.trim() ? '#555' : 'black' }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
              Генерирую...
            </span>
          ) : user ? "Сгенерировать изображение" : "Войдите чтобы генерировать"}
        </button>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl flex items-center gap-2 animate-fade-in"
            style={{ background: 'rgba(255,45,155,0.08)', border: '1px solid rgba(255,45,155,0.2)' }}>
            <Icon name="AlertCircle" size={14} className="text-neon-pink flex-shrink-0" />
            <span className="text-xs font-body text-neon-pink">{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3 animate-fade-in">
            <div className="relative rounded-xl overflow-hidden group">
              <img src={result.image_url} alt={result.prompt}
                className="w-full object-cover rounded-xl"
                style={{ maxHeight: 480 }} />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end"
                style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                <div className="p-4 w-full flex items-end justify-between">
                  <p className="font-body text-xs text-white/80 flex-1 line-clamp-2">{result.prompt}</p>
                  <a href={result.image_url} download target="_blank" rel="noopener noreferrer"
                    className="ml-3 w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                    style={{ background: 'rgba(0,245,255,0.2)', border: '1px solid rgba(0,245,255,0.4)' }}>
                    <Icon name="Download" size={16} className="text-neon-cyan" />
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-body text-muted-foreground">Готово! Наведи на изображение для скачивания</span>
              <button onClick={() => setResult(null)}
                className="text-xs font-body text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                <Icon name="RefreshCw" size={12} />
                Новое
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── STUDIO SECTION ─── */
function StudioSection({ user, onLoginRequired }: { user: User | null; onLoginRequired: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mockFiles = [
    "photo_001.jpg", "photo_002.jpg", "video_001.mp4",
    "photo_003.png", "video_002.mov", "photo_004.jpg",
    "photo_005.jpg", "text_brief.txt",
  ];

  function handleDrop() { setFiles(mockFiles); }

  function handleProcess() {
    setProcessing(true);
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(intervalRef.current!); setProcessing(false); return 100; }
        return p + Math.random() * 8;
      });
    }, 150);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 280 }}>
        <img src={HERO_IMAGE} alt="AI Studio" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.1) 0%, rgba(178,75,255,0.1) 100%)' }} />
        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-end h-full" style={{ minHeight: 280 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-4 w-fit"
            style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: '#00f5ff' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" />
            ИИ онлайн — обрабатывает запросы
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold uppercase text-white leading-tight mb-3">
            Создавай<br /><span className="gradient-text">без границ</span>
          </h1>
          <p className="font-body text-muted-foreground text-lg max-w-lg">
            Генерация фото, видео и текста. Массовая обработка файлов за секунды.
          </p>
        </div>
      </div>

      {/* ── TEXT TO IMAGE ── */}
      <TextToImage user={user} onLoginRequired={onLoginRequired} />

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Массовая обработка</span>
        <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
      </div>

      {/* Dropzone */}
      <div onClick={handleDrop}
        className="rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:scale-[1.01]"
        style={{ border: '2px dashed var(--dark-border)', background: 'var(--dark-card)' }}>
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)' }}>
              <Icon name="Upload" size={24} className="text-neon-cyan" />
            </div>
            <div>
              <p className="font-body font-semibold text-white">Перетащите файлы сюда</p>
              <p className="font-body text-sm text-muted-foreground mt-1">поддержка <span className="text-neon-cyan">массовой загрузки</span></p>
            </div>
            <span className="text-xs font-body text-muted-foreground px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
              JPG, PNG, MP4, MOV, TXT — до 10 000 файлов
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-white uppercase tracking-wider">{files.length} файлов</span>
              <button onClick={e => { e.stopPropagation(); setFiles([]); }} className="text-muted-foreground hover:text-white transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="text-xs font-body px-2 py-1 rounded-lg text-neon-cyan"
                  style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.15)' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {processing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-body">
            <span className="text-neon-cyan">Обрабатываю...</span>
            <span className="text-white font-semibold">{Math.min(Math.round(progress), 100)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--dark-border)' }}>
            <div className="h-full rounded-full transition-all duration-150"
              style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #00f5ff, #b24bff)' }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { val: "12 481", label: "Файлов обработано" },
          { val: "< 3с", label: "Среднее время" },
          { val: "99.9%", label: "Точность" },
        ].map(({ val, label }, i) => (
          <div key={i} className="p-4 rounded-xl text-center" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="font-display text-2xl font-bold gradient-text">{val}</div>
            <div className="text-xs font-body text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <button onClick={handleProcess} disabled={processing}
        className="w-full py-4 rounded-xl font-display font-bold text-lg uppercase tracking-widest transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: processing ? 'var(--dark-border)' : 'linear-gradient(135deg, #00f5ff, #b24bff)', color: processing ? '#888' : 'black' }}>
        {processing ? "Обрабатываю..." : "Запустить массовую обработку"}
      </button>
    </div>
  );
}

/* ─── EDITOR SECTION ─── */
function EditorSection() {
  const [activeMove, setActiveMove] = useState("orbit");
  const [zoom, setZoom] = useState(50);
  const [speed, setSpeed] = useState(30);

  const moves = [
    { id: "orbit", label: "Орбита", icon: "RotateCcw", desc: "Круговое движение вокруг объекта" },
    { id: "dolly", label: "Долли", icon: "ArrowRight", desc: "Плавный наезд / отъезд камеры" },
    { id: "tilt", label: "Тилт", icon: "ArrowUpDown", desc: "Наклон вверх-вниз" },
    { id: "pan", label: "Панорама", icon: "Scan", desc: "Горизонтальная панорама" },
    { id: "crane", label: "Кран", icon: "TrendingUp", desc: "Вертикальный подъём камеры" },
    { id: "hyperlapse", label: "Гиперлапс", icon: "Zap", desc: "Ускоренное движение" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-4"
          style={{ background: 'rgba(178,75,255,0.1)', border: '1px solid rgba(178,75,255,0.3)', color: '#b24bff' }}>
          <Icon name="Film" size={12} />
          Редактор движения камеры
        </div>
        <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-white leading-tight">
          Движение<br /><span className="gradient-text">в кадре</span>
        </h2>
        <p className="font-body text-muted-foreground mt-3 max-w-lg">
          Добавь профессиональные движения камеры к любому видео или статичному изображению. ИИ генерирует плавные траектории.
        </p>
      </div>

      {/* Preview canvas */}
      <div className="relative rounded-2xl overflow-hidden aspect-video flex items-center justify-center"
        style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(178,75,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(178,75,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />

        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse-glow"
            style={{ background: 'rgba(178,75,255,0.15)', border: '1px solid rgba(178,75,255,0.3)' }}>
            <Icon name="Video" size={32} className="text-neon-violet" />
          </div>
          <div className="absolute w-32 h-32 rounded-full animate-orbit" style={{ border: '1px dashed rgba(0,245,255,0.3)' }}>
            <div className="w-3 h-3 rounded-full bg-neon-cyan absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 glow-cyan" />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <span className="text-xs font-body text-muted-foreground px-2 py-1 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            Режим: <span className="text-neon-violet font-semibold">{moves.find(m => m.id === activeMove)?.label}</span>
          </span>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Icon name="Play" size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Movement grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {moves.map((m) => (
          <button key={m.id} onClick={() => setActiveMove(m.id)}
            className={`p-4 rounded-xl text-left transition-all duration-300 hover:scale-105 ${activeMove === m.id ? "glow-violet" : ""}`}
            style={{
              background: activeMove === m.id ? 'rgba(178,75,255,0.1)' : 'var(--dark-card)',
              border: activeMove === m.id ? '1px solid rgba(178,75,255,0.4)' : '1px solid var(--dark-border)'
            }}>
            <Icon name={m.icon} size={20} className={activeMove === m.id ? "text-neon-violet" : "text-muted-foreground"} />
            <p className={`font-display font-semibold uppercase tracking-wider text-sm mt-2 ${activeMove === m.id ? "text-neon-violet" : "text-white"}`}>{m.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="grid md:grid-cols-2 gap-6 p-6 rounded-xl" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <div className="space-y-3">
          <div className="flex justify-between text-sm font-body">
            <span className="text-white font-medium">Масштаб зума</span>
            <span className="text-neon-cyan font-semibold">{zoom}%</span>
          </div>
          <input type="range" min={0} max={100} value={zoom} onChange={e => setZoom(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: '#00f5ff' }} />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm font-body">
            <span className="text-white font-medium">Скорость движения</span>
            <span className="text-neon-violet font-semibold">{speed}%</span>
          </div>
          <input type="range" min={0} max={100} value={speed} onChange={e => setSpeed(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: '#b24bff' }} />
        </div>
      </div>

      <button className="w-full py-4 rounded-xl font-display font-bold text-lg uppercase tracking-widest text-black transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #b24bff, #ff2d9b)' }}>
        Применить движение
      </button>
    </div>
  );
}

/* ─── GALLERY SECTION ─── */
function GallerySection() {
  const [filter, setFilter] = useState<"all" | "image" | "video" | "text">("all");
  const [selected, setSelected] = useState<number | null>(null);

  const filtered = filter === "all" ? galleryItems : galleryItems.filter(g => g.type === filter);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-4"
          style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.3)', color: '#ff2d9b' }}>
          <Icon name="Sparkles" size={12} />
          Галерея работ
        </div>
        <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-white leading-tight">
          Ваши<br /><span className="gradient-text">шедевры</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["all", "image", "video", "text"] as const).map((f) => {
          const labels = { all: "Все", image: "Фото", video: "Видео", text: "Текст" };
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 ${filter === f ? "text-black" : "text-muted-foreground hover:text-white"}`}
              style={filter === f ? { background: 'linear-gradient(135deg, #ff2d9b, #b24bff)' } : { background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              {labels[f]}
            </button>
          );
        })}
        <div className="ml-auto">
          <span className="text-xs font-body text-muted-foreground">{filtered.length} результатов</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((item, idx) => {
          const t = typeMap[item.type];
          const isSelected = selected === item.id;
          return (
            <div key={item.id}
              onClick={() => setSelected(isSelected ? null : item.id)}
              className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isSelected ? "scale-[1.02]" : ""}`}
              style={{
                background: 'var(--dark-card)',
                border: isSelected ? '1px solid #ff2d9b' : '1px solid var(--dark-border)',
                boxShadow: isSelected ? '0 0 20px rgba(255,45,155,0.2)' : 'none',
                animationDelay: `${idx * 0.08}s`,
              }}>
              <div className="aspect-square flex flex-col items-center justify-center relative"
                style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.5), ${item.type === 'image' ? 'rgba(0,245,255,0.05)' : item.type === 'video' ? 'rgba(178,75,255,0.05)' : 'rgba(255,45,155,0.05)'})` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: item.type === 'image' ? 'rgba(0,245,255,0.1)' : item.type === 'video' ? 'rgba(178,75,255,0.1)' : 'rgba(255,45,155,0.1)' }}>
                  <Icon name={t.icon} size={24} className={t.color} />
                </div>
                <p className="text-xs font-body text-muted-foreground text-center px-3 leading-tight">{item.prompt}</p>

                {isSelected && <div className="absolute inset-0 animate-shimmer pointer-events-none" />}
              </div>

              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-sm uppercase tracking-wide text-white">{item.label}</p>
                  <p className="text-xs font-body text-muted-foreground">Генерация: {item.time}</p>
                </div>
                <div className="flex gap-1">
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    onClick={(e) => e.stopPropagation()}>
                    <Icon name="Download" size={13} className="text-muted-foreground" />
                  </button>
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    onClick={(e) => e.stopPropagation()}>
                    <Icon name="Share2" size={13} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="p-4 rounded-xl flex items-center justify-between animate-fade-in"
          style={{ background: 'rgba(255,45,155,0.06)', border: '1px solid rgba(255,45,155,0.2)' }}>
          <span className="font-body text-sm text-white">Выбран элемент #{selected}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs font-body font-medium text-black"
              style={{ background: 'linear-gradient(135deg, #ff2d9b, #b24bff)' }}>
              Редактировать
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-body text-muted-foreground"
              style={{ background: 'var(--dark-border)' }}
              onClick={() => setSelected(null)}>
              Снять
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── BILLING SECTION ─── */
function BillingSection() {
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState("Про");

  const colorMap: Record<string, string> = {
    cyan: 'linear-gradient(135deg, #00f5ff, #0099bb)',
    violet: 'linear-gradient(135deg, #b24bff, #7a00ff)',
    pink: 'linear-gradient(135deg, #ff2d9b, #b24bff)',
  };

  const glowMap: Record<string, string> = {
    cyan: 'rgba(0,245,255,0.2)',
    violet: 'rgba(178,75,255,0.2)',
    pink: 'rgba(255,45,155,0.2)',
  };

  const textMap: Record<string, string> = {
    cyan: 'text-neon-cyan',
    violet: 'text-neon-violet',
    pink: 'text-neon-pink',
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-4"
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)', color: '#00f5ff' }}>
          <Icon name="CreditCard" size={12} />
          Тарифы и оплата
        </div>
        <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-white leading-tight">
          Выбери<br /><span className="gradient-text">свой план</span>
        </h2>

        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`font-body text-sm ${!annual ? "text-white" : "text-muted-foreground"}`}>Ежемесячно</span>
          <button onClick={() => setAnnual(!annual)}
            className="relative w-12 h-6 rounded-full transition-all duration-300"
            style={{ background: annual ? 'linear-gradient(135deg, #00f5ff, #b24bff)' : 'var(--dark-border)' }}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${annual ? "left-7" : "left-1"}`} />
          </button>
          <span className={`font-body text-sm ${annual ? "text-white" : "text-muted-foreground"}`}>
            Годовой <span className="text-neon-cyan">−20%</span>
          </span>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isSelected = selected === plan.name;
          const rawPrice = parseInt(plan.price.replace(/\s/, ''));
          const price = annual ? Math.round(rawPrice * 0.8).toLocaleString("ru") : plan.price;
          return (
            <div key={plan.name} onClick={() => setSelected(plan.name)}
              className="relative p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'var(--dark-card)',
                border: isSelected ? `1px solid rgba(${plan.color === 'cyan' ? '0,245,255' : plan.color === 'violet' ? '178,75,255' : '255,45,155'},0.5)` : '1px solid var(--dark-border)',
                boxShadow: isSelected ? `0 0 40px ${glowMap[plan.color]}` : 'none',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-display font-bold uppercase tracking-widest text-black"
                  style={{ background: colorMap[plan.color] }}>
                  Популярный
                </div>
              )}

              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `rgba(${plan.color === 'cyan' ? '0,245,255' : plan.color === 'violet' ? '178,75,255' : '255,45,155'},0.1)` }}>
                <Icon name="Layers" size={20} className={textMap[plan.color]} />
              </div>

              <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">{plan.name}</h3>

              <div className="mt-3 mb-5 flex items-end gap-1">
                <span className="font-display text-4xl font-bold text-white">{price}</span>
                <span className="font-body text-muted-foreground mb-1">₽ / {plan.period}</span>
              </div>

              <div className="space-y-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `rgba(${plan.color === 'cyan' ? '0,245,255' : plan.color === 'violet' ? '178,75,255' : '255,45,155'},0.15)` }}>
                      <Icon name="Check" size={10} className={textMap[plan.color]} />
                    </div>
                    <span className="font-body text-sm text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>

              {isSelected ? (
                <a
                  href={`https://t.me/NPCsteve?text=${encodeURIComponent(`Хочу подключить тариф "${plan.name}" — ${price}₽/${plan.period}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm transition-all hover:scale-105 text-black"
                  style={{ background: colorMap[plan.color] }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.525 13.46l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.623.099z"/>
                  </svg>
                  Оплатить в Telegram
                </a>
              ) : (
                <button className="w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm transition-all hover:scale-105"
                  style={{ background: 'var(--dark-border)', color: 'white' }}>
                  Выбрать
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage meter */}
      <div className="p-6 rounded-2xl space-y-4" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">Текущее использование</h3>
        {[
          { label: "Генерации фото", used: 342, total: 500, color: '#00f5ff' },
          { label: "Генерации видео", used: 87, total: 100, color: '#b24bff' },
          { label: "Текстовые запросы", used: 1240, total: 2000, color: '#ff2d9b' },
        ].map(({ label, used, total, color }) => (
          <div key={label} className="space-y-1.5">
            <div className="flex justify-between text-sm font-body">
              <span className="text-white">{label}</span>
              <span className="text-muted-foreground">{used} / {total}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--dark-border)' }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${(used / total) * 100}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PROFILE SECTION ─── */
function ProfileSection({ user, onUpdated, onLogout }: { user: User; onUpdated: () => void; onLogout: () => void }) {
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // TOTP setup state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Disable TOTP
  const [disablePass, setDisablePass] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  function authHeaders() {
    const t = localStorage.getItem('session_token') || '';
    return { 'Content-Type': 'application/json', 'X-Session-Token': t };
  }

  async function applyPromo() {
    if (!promo.trim()) return;
    setBusy(true); setPromoMsg(null);
    try {
      const r = await fetch(API.auth, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'redeem-promo', code: promo.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      setPromoMsg({ type: 'ok', text: `+${data.amount} генераций. Баланс: ${data.balance}` });
      setPromo('');
      onUpdated();
    } catch (e: unknown) {
      setPromoMsg({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setBusy(false);
    }
  }

  async function startTotpSetup() {
    setBusy(true); setTotpMsg(null);
    try {
      const r = await fetch(API.auth, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'totp-setup' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      setTotpSetup(data);
    } catch (e: unknown) {
      setTotpMsg({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setBusy(false);
    }
  }

  async function confirmTotp() {
    if (!/^\d{6}$/.test(totpCode)) { setTotpMsg({ type: 'err', text: 'Введите 6 цифр' }); return; }
    setBusy(true); setTotpMsg(null);
    try {
      const r = await fetch(API.auth, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'totp-enable', code: totpCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      setTotpMsg({ type: 'ok', text: '2FA включена' });
      setTotpSetup(null);
      setTotpCode('');
      onUpdated();
    } catch (e: unknown) {
      setTotpMsg({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setBusy(false);
    }
  }

  async function disableTotp() {
    if (!disablePass) { setTotpMsg({ type: 'err', text: 'Введите пароль' }); return; }
    setBusy(true); setTotpMsg(null);
    try {
      const r = await fetch(API.auth, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'totp-disable', password: disablePass }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      setTotpMsg({ type: 'ok', text: '2FA отключена' });
      setDisablePass(''); setShowDisable(false);
      onUpdated();
    } catch (e: unknown) {
      setTotpMsg({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setBusy(false);
    }
  }

  const otpauthQr = totpSetup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetup.otpauth_url)}`
    : '';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header card */}
      <div className="p-6 rounded-2xl flex items-center gap-4" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)' }}>
          {(user.name || user.email)[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg font-bold text-white truncate">{user.name || user.email}</p>
          <p className="font-body text-sm text-muted-foreground truncate">{user.email}</p>
          {user.is_admin && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-display uppercase tracking-wider"
              style={{ background: 'rgba(255,45,155,0.15)', border: '1px solid rgba(255,45,155,0.4)', color: '#ff2d9b' }}>
              Админ
            </span>
          )}
        </div>
      </div>

      {/* Balance card */}
      <div className="p-6 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.08), rgba(178,75,255,0.08))', border: '1px solid rgba(0,245,255,0.25)' }}>
        <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-2">Баланс генераций</p>
        <div className="font-display text-5xl font-bold gradient-text mb-2">{user.balance}</div>
        <p className="font-body text-xs text-muted-foreground">1 генерация = 1 единица</p>
      </div>

      {/* Promo */}
      <div className="p-6 rounded-2xl space-y-3" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <div className="flex items-center gap-2">
          <Icon name="Ticket" size={18} className="text-neon-cyan" />
          <h3 className="font-display font-bold uppercase tracking-wider text-white">Активировать промокод</h3>
        </div>
        <div className="flex gap-2">
          <input type="text" value={promo} onChange={e => { setPromo(e.target.value.toUpperCase()); setPromoMsg(null); }}
            placeholder="ВАШ-КОД"
            className="flex-1 px-4 py-3 rounded-xl font-display text-sm tracking-widest outline-none uppercase"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
          <button onClick={applyPromo} disabled={busy || !promo.trim()}
            className="px-5 rounded-xl font-body font-semibold disabled:opacity-50 transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)', color: 'black' }}>
            Применить
          </button>
        </div>
        {promoMsg && (
          <p className="text-xs font-body flex items-center gap-1" style={{ color: promoMsg.type === 'ok' ? '#00f5ff' : '#ff2d9b' }}>
            <Icon name={promoMsg.type === 'ok' ? 'CheckCircle2' : 'AlertCircle'} size={12} />
            {promoMsg.text}
          </p>
        )}
        <a href="https://t.me/Niger_epta" target="_blank" rel="noopener"
          className="flex items-center justify-center gap-2 text-sm font-body text-muted-foreground hover:text-white transition-colors py-2">
          <Icon name="Send" size={14} />
          Купить промокод в Telegram → @Niger_epta
        </a>
      </div>

      {/* TOTP / 2FA */}
      <div className="p-6 rounded-2xl space-y-3" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="ShieldCheck" size={18} className={user.totp_enabled ? 'text-neon-cyan' : 'text-muted-foreground'} />
            <h3 className="font-display font-bold uppercase tracking-wider text-white">Двухфакторка (TOTP)</h3>
          </div>
          {user.totp_enabled && <span className="text-xs font-body text-neon-cyan">Включено</span>}
        </div>
        <p className="font-body text-xs text-muted-foreground leading-relaxed">
          Google Authenticator, Authy, 1Password или Яндекс.Ключ — любое TOTP-приложение.
        </p>

        {!user.totp_enabled && !totpSetup && (
          <button onClick={startTotpSetup} disabled={busy}
            className="w-full py-3 rounded-xl font-body font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: '#00f5ff' }}>
            Подключить 2FA
          </button>
        )}

        {totpSetup && (
          <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.2)' }}>
            <p className="text-xs font-body text-muted-foreground">1. Отсканируйте QR в приложении-аутентификаторе:</p>
            <div className="flex justify-center">
              <img src={otpauthQr} alt="QR" className="w-44 h-44 rounded-lg bg-white p-2" />
            </div>
            <p className="text-xs font-body text-muted-foreground">или введите вручную секрет:</p>
            <div className="px-3 py-2 rounded-lg font-mono text-xs text-neon-cyan break-all"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--dark-border)' }}>
              {totpSetup.secret}
            </div>
            <p className="text-xs font-body text-muted-foreground">2. Введите 6 цифр из приложения:</p>
            <input type="text" inputMode="numeric" maxLength={6}
              value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 rounded-xl font-display text-center text-xl tracking-[0.5em] outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
            <button onClick={confirmTotp} disabled={busy}
              className="w-full py-3 rounded-xl font-body font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)', color: 'black' }}>
              Подтвердить
            </button>
          </div>
        )}

        {user.totp_enabled && !showDisable && (
          <button onClick={() => setShowDisable(true)}
            className="w-full py-3 rounded-xl font-body text-sm text-muted-foreground hover:text-neon-pink transition-colors"
            style={{ border: '1px solid var(--dark-border)' }}>
            Отключить 2FA
          </button>
        )}

        {user.totp_enabled && showDisable && (
          <div className="space-y-2 p-4 rounded-xl" style={{ background: 'rgba(255,45,155,0.04)', border: '1px solid rgba(255,45,155,0.2)' }}>
            <p className="text-xs font-body text-muted-foreground">Подтвердите паролем:</p>
            <input type="password" value={disablePass} onChange={e => setDisablePass(e.target.value)}
              placeholder="Текущий пароль"
              className="w-full px-4 py-3 rounded-xl font-body text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
            <div className="flex gap-2">
              <button onClick={() => { setShowDisable(false); setDisablePass(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-body text-muted-foreground"
                style={{ border: '1px solid var(--dark-border)' }}>
                Отмена
              </button>
              <button onClick={disableTotp} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-body font-semibold text-white disabled:opacity-50"
                style={{ background: 'rgba(255,45,155,0.6)' }}>
                Отключить
              </button>
            </div>
          </div>
        )}

        {totpMsg && (
          <p className="text-xs font-body flex items-center gap-1" style={{ color: totpMsg.type === 'ok' ? '#00f5ff' : '#ff2d9b' }}>
            <Icon name={totpMsg.type === 'ok' ? 'CheckCircle2' : 'AlertCircle'} size={12} />
            {totpMsg.text}
          </p>
        )}
      </div>

      <button onClick={onLogout}
        className="w-full py-3 rounded-xl font-body text-sm text-muted-foreground hover:text-white transition-colors flex items-center justify-center gap-2"
        style={{ border: '1px solid var(--dark-border)' }}>
        <Icon name="LogOut" size={14} />
        Выйти из аккаунта
      </button>
    </div>
  );
}

/* ─── ADMIN SECTION ─── */
type PromoItem = {
  id: number; code: string; amount: number;
  created_at: string; used_at: string | null; comment: string | null;
  used_by_email: string | null;
};
type Stats = { users: number; promo_total: number; promo_used: number; promo_redeemed_amount: number; generations: number };

function AdminSection() {
  const [amount, setAmount] = useState(50);
  const [count, setCount] = useState(1);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PromoItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PromoItem[]>([]);

  function authHeaders() {
    const t = localStorage.getItem('session_token') || '';
    return { 'Content-Type': 'application/json', 'X-Session-Token': t };
  }

  async function loadAll() {
    setError('');
    try {
      const [r1, r2] = await Promise.all([
        fetch(API.admin, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'list-promo' }) }),
        fetch(API.admin, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'stats' }) }),
      ]);
      const d1 = await r1.json(); const d2 = await r2.json();
      if (!r1.ok) throw new Error(d1.error || 'Ошибка');
      if (!r2.ok) throw new Error(d2.error || 'Ошибка');
      setItems(d1.items || []);
      setStats(d2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function createPromo() {
    if (amount < 1) return;
    setBusy(true); setError(''); setCreated([]);
    try {
      const r = await fetch(API.admin, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'create-promo', amount, count, comment: comment.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Ошибка');
      setCreated(data.created || []);
      setComment('');
      loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  function copy(txt: string) {
    navigator.clipboard?.writeText(txt);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-3"
          style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.3)', color: '#ff2d9b' }}>
          <Icon name="ShieldAlert" size={12} />
          Только для администратора
        </div>
        <h2 className="font-display text-3xl font-bold uppercase text-white">Админ-панель</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">Создание промокодов после оплаты в <a href="https://t.me/Niger_epta" target="_blank" rel="noopener" className="text-neon-cyan underline underline-offset-2">@Niger_epta</a></p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Пользователи', val: stats.users, icon: 'Users' },
            { label: 'Промокодов', val: stats.promo_total, icon: 'Ticket' },
            { label: 'Активировано', val: stats.promo_used, icon: 'CheckCircle2' },
            { label: 'Генераций', val: stats.generations, icon: 'Sparkles' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              <Icon name={s.icon} size={16} className="text-neon-cyan mb-2" />
              <div className="font-display text-2xl font-bold text-white">{s.val}</div>
              <div className="text-xs font-body text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create promo */}
      <div className="p-6 rounded-2xl space-y-4" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <h3 className="font-display font-bold uppercase tracking-wider text-white">Создать промокод</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-body text-muted-foreground">Генераций в коде</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full mt-1 px-4 py-3 rounded-xl font-body text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
          </div>
          <div>
            <label className="text-xs font-body text-muted-foreground">Сколько кодов</label>
            <input type="number" min={1} max={100} value={count} onChange={e => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="w-full mt-1 px-4 py-3 rounded-xl font-body text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
          </div>
        </div>
        <div>
          <label className="text-xs font-body text-muted-foreground">Комментарий (для кого/за что)</label>
          <input type="text" value={comment} onChange={e => setComment(e.target.value)}
            placeholder="например: оплата от @username 990₽"
            className="w-full mt-1 px-4 py-3 rounded-xl font-body text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)', color: 'white' }} />
        </div>
        <button onClick={createPromo} disabled={busy}
          className="w-full py-3 rounded-xl font-body font-semibold disabled:opacity-50 hover:scale-[1.02] transition-all"
          style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)', color: 'black' }}>
          Создать
        </button>
        {error && <p className="text-xs font-body text-neon-pink">{error}</p>}

        {created.length > 0 && (
          <div className="space-y-2 p-4 rounded-xl" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.2)' }}>
            <p className="text-xs font-body text-neon-cyan">Скопируйте и отправьте клиенту:</p>
            {created.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg font-mono text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--dark-border)' }}>
                  {c.code}
                </code>
                <span className="text-xs font-body text-muted-foreground">{c.amount} ген.</span>
                <button onClick={() => copy(c.code)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <Icon name="Copy" size={14} className="text-neon-cyan" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="p-6 rounded-2xl space-y-3" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
        <h3 className="font-display font-bold uppercase tracking-wider text-white">Все промокоды ({items.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl text-sm"
              style={{ background: p.used_at ? 'rgba(255,255,255,0.02)' : 'rgba(0,245,255,0.04)', border: '1px solid var(--dark-border)' }}>
              <code className="font-mono text-xs text-white">{p.code}</code>
              <span className="text-xs font-body text-muted-foreground">{p.amount}</span>
              {p.used_at ? (
                <span className="ml-auto text-xs font-body text-muted-foreground truncate">
                  использован: {p.used_by_email || '—'}
                </span>
              ) : (
                <>
                  <span className="ml-auto text-xs font-body text-neon-cyan">активен</span>
                  <button onClick={() => copy(p.code)} className="p-1 rounded hover:bg-white/5">
                    <Icon name="Copy" size={12} className="text-neon-cyan" />
                  </button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-xs font-body text-muted-foreground text-center py-6">Промокодов пока нет</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function Index() {
  const [active, setActive] = useState<Section>("studio");
  const [showAuth, setShowAuth] = useState(false);
  const { user, loading, logout, refresh, setUser } = useAuth();

  useEffect(() => {
    if (!loading && !user && window.location.search.includes('error')) {
      setShowAuth(true);
    }
  }, [loading, user]);

  // Если попали в profile/admin без авторизации — открываем модалку
  useEffect(() => {
    if ((active === 'profile' || active === 'admin') && !loading && !user) {
      setShowAuth(true);
      setActive('studio');
    }
    if (active === 'admin' && user && !user.is_admin) {
      setActive('studio');
    }
  }, [active, user, loading]);

  const navItems: { s: Section; icon: string; label: string; show: boolean }[] = [
    { s: 'studio', icon: 'Wand2', label: 'Студия', show: true },
    { s: 'editor', icon: 'Film', label: 'Редактор', show: true },
    { s: 'gallery', icon: 'LayoutGrid', label: 'Галерея', show: true },
    { s: 'billing', icon: 'CreditCard', label: 'Биллинг', show: true },
    { s: 'profile', icon: 'User', label: 'Профиль', show: !!user },
    { s: 'admin', icon: 'ShieldAlert', label: 'Админ', show: !!user?.is_admin },
  ];
  const visibleNav = navItems.filter(i => i.show);

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      <GridBackground />
      <Navbar
        active={active}
        setActive={setActive}
        user={user}
        onLoginClick={() => setShowAuth(true)}
        onLogout={logout}
      />
      <Ticker />

      {/* отступ снизу: nav (~64px) + бейдж Poehali (~70px) = 140px на мобильных, 80px на десктопе */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-[160px] md:pb-24">
        {active === "studio" && <StudioSection user={user} onLoginRequired={() => setShowAuth(true)} />}
        {active === "editor" && <EditorSection />}
        {active === "gallery" && <GallerySection />}
        {active === "billing" && <BillingSection />}
        {active === "profile" && user && <ProfileSection user={user} onUpdated={refresh} onLogout={() => { logout(); setActive('studio'); }} />}
        {active === "admin" && user?.is_admin && <AdminSection />}
      </main>

      {/* Bottom mobile nav — приподнят над бейджем Poehali */}
      <div className="md:hidden fixed left-0 right-0 z-50 border-t glass"
        style={{ borderColor: 'var(--dark-border)', bottom: '70px' }}>
        <div className="flex overflow-x-auto">
          {visibleNav.map(({ s, icon, label }) => {
            const isActive = active === s;
            return (
              <button key={s} onClick={() => setActive(s)}
                className={`flex-1 min-w-[64px] py-3 flex flex-col items-center gap-1 transition-all ${isActive ? "" : "opacity-50"}`}>
                <Icon name={icon} size={20} className={isActive ? "text-neon-cyan" : "text-muted-foreground"} />
                <span className={`text-[10px] font-display uppercase tracking-wider whitespace-nowrap ${isActive ? "text-neon-cyan" : "text-muted-foreground"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(u) => setUser(u)} />}
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

type Section = "studio" | "editor" | "gallery" | "billing";

const HERO_IMAGE = "https://cdn.poehali.dev/projects/1da53510-a90a-4c19-87dc-ee717d9f851a/files/90016d74-ebc6-4d0f-bdfb-14671d849e86.jpg";

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

/* ─── NAVBAR ─── */
function Navbar({ active, setActive }: { active: Section; setActive: (s: Section) => void }) {
  const [scrolled, setScrolled] = useState(false);

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

        <button className="px-4 py-2 rounded-lg text-sm font-body font-semibold text-black transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #00f5ff, #b24bff)' }}>
          Войти
        </button>
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

/* ─── STUDIO SECTION ─── */
function StudioSection() {
  const [files, setFiles] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"image" | "video" | "text">("image");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modes = [
    { id: "image" as const, label: "Фото", icon: "Image" },
    { id: "video" as const, label: "Видео", icon: "Film" },
    { id: "text" as const, label: "Текст", icon: "FileText" },
  ];

  const mockFiles = [
    "photo_001.jpg", "photo_002.jpg", "video_001.mp4",
    "photo_003.png", "video_002.mov", "photo_004.jpg",
    "photo_005.jpg", "text_brief.txt",
  ];

  function handleDrop() {
    setFiles(mockFiles);
  }

  function handleProcess() {
    setProcessing(true);
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current!);
          setProcessing(false);
          return 100;
        }
        return p + Math.random() * 8;
      });
    }, 150);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 320 }}>
        <img src={HERO_IMAGE} alt="AI Studio" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.1) 0%, rgba(178,75,255,0.1) 100%)' }} />
        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-end h-full" style={{ minHeight: 320 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-body mb-4 w-fit"
            style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: '#00f5ff' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-glow" />
            ИИ онлайн — обрабатывает запросы
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold uppercase text-white leading-tight mb-3">
            Создавай<br />
            <span className="gradient-text">без границ</span>
          </h1>
          <p className="font-body text-muted-foreground text-lg max-w-lg">
            Массовая генерация фото, видео и текста одновременно. Загрузи тысячи файлов — обработай за секунды.
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-3 gap-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-300 ${mode === m.id ? "glow-cyan" : "hover:scale-105"}`}
            style={{ background: mode === m.id ? 'rgba(0,245,255,0.08)' : 'var(--dark-card)', border: mode === m.id ? '1px solid rgba(0,245,255,0.4)' : '1px solid var(--dark-border)' }}>
            <Icon name={m.icon} size={24} className={mode === m.id ? "text-neon-cyan" : "text-muted-foreground"} />
            <span className={`font-display text-sm font-medium uppercase tracking-wider ${mode === m.id ? "text-neon-cyan" : "text-muted-foreground"}`}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Prompt */}
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Опишите что нужно создать... Например: портрет в стиле киберпанк, неоновые огни ночного города"
          rows={3}
          className="w-full px-4 py-3 rounded-xl font-body text-sm placeholder:text-muted-foreground resize-none outline-none transition-all focus:border-neon-cyan/50"
          style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', color: 'white' }}
        />
      </div>

      {/* Dropzone */}
      <div onClick={handleDrop}
        className="rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:border-neon-cyan/40"
        style={{ border: '2px dashed var(--dark-border)', background: 'var(--dark-card)' }}>
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)' }}>
              <Icon name="Upload" size={24} className="text-neon-cyan" />
            </div>
            <div>
              <p className="font-body font-semibold text-white">Перетащите файлы сюда</p>
              <p className="font-body text-sm text-muted-foreground mt-1">или нажмите для выбора — поддержка <span className="text-neon-cyan">массовой загрузки</span></p>
            </div>
            <span className="text-xs font-body text-muted-foreground px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
              JPG, PNG, MP4, MOV, TXT — до 10 000 файлов
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-white uppercase tracking-wider">{files.length} файлов загружено</span>
              <button onClick={(e) => { e.stopPropagation(); setFiles([]); }} className="text-muted-foreground hover:text-white transition-colors">
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

      {/* Progress */}
      {processing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-body">
            <span className="text-neon-cyan">Генерация...</span>
            <span className="text-white font-semibold">{Math.min(Math.round(progress), 100)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--dark-border)' }}>
            <div className="h-full rounded-full transition-all duration-150"
              style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #00f5ff, #b24bff)' }} />
          </div>
        </div>
      )}

      {/* Stats row */}
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

      {/* CTA */}
      <button onClick={handleProcess} disabled={processing}
        className="w-full py-4 rounded-xl font-display font-bold text-lg uppercase tracking-widest transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: processing ? 'var(--dark-border)' : 'linear-gradient(135deg, #00f5ff, #b24bff)', color: processing ? '#888' : 'black' }}>
        {processing ? "Обрабатываю..." : "Запустить генерацию"}
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

              <button className="w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm transition-all hover:scale-105"
                style={isSelected ? { background: colorMap[plan.color], color: 'black' } : { background: 'var(--dark-border)', color: 'white' }}>
                {isSelected ? "Подключить" : "Выбрать"}
              </button>
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

/* ─── MAIN ─── */
export default function Index() {
  const [active, setActive] = useState<Section>("studio");

  const sections: Record<Section, JSX.Element> = {
    studio: <StudioSection />,
    editor: <EditorSection />,
    gallery: <GallerySection />,
    billing: <BillingSection />,
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      <GridBackground />
      <Navbar active={active} setActive={setActive} />
      <Ticker />

      <main className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-24">
        {sections[active]}
      </main>

      {/* Bottom mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t glass"
        style={{ borderColor: 'var(--dark-border)' }}>
        <div className="flex">
          {(["studio", "editor", "gallery", "billing"] as Section[]).map((s) => {
            const icons: Record<Section, string> = { studio: "Wand2", editor: "Film", gallery: "LayoutGrid", billing: "CreditCard" };
            const labels: Record<Section, string> = { studio: "Студия", editor: "Редактор", gallery: "Галерея", billing: "Биллинг" };
            const isActive = active === s;
            return (
              <button key={s} onClick={() => setActive(s)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${isActive ? "" : "opacity-50"}`}>
                <Icon name={icons[s]} size={20} className={isActive ? "text-neon-cyan" : "text-muted-foreground"} />
                <span className={`text-[10px] font-display uppercase tracking-wider ${isActive ? "text-neon-cyan" : "text-muted-foreground"}`}>{labels[s]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

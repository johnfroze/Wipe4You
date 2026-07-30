import { useEffect, useRef, useState } from 'react';

interface Props {
  onLogin: () => void;
}

export default function HomePage({ onLogin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // ── Loading screen ──
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // ── Scroll tracking ──
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Particle canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particles — embers + fog
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 0.6 + 0.1),
      alpha: Math.random() * 0.7 + 0.1,
      gold: Math.random() > 0.4,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.pulse += 0.02;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(212,175,55,${a})`
          : `rgba(180,130,60,${a * 0.5})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const stats = [
    { value: '847+', label: 'Active Members', icon: '⚔️' },
    { value: 'S-Rank', label: 'Guild Power', icon: '🏆' },
    { value: '12/14', label: 'Territory Control', icon: '🗺️' },
    { value: '98%', label: 'Raid Clears', icon: '🔥' },
    { value: '3,241', label: 'PvP Victories', icon: '💀' },
  ];

  const streamers = [
    {
      name: 'HOFjfroze',
      game: 'Legend of YMIR',
      link: 'https://sss.wemixplay.com/en/lygl/board/9912',
    },
    {
      name: 'JKGaming',
      game: 'Legend of YMIR',
      link: 'https://sss.wemixplay.com/en/lygl/board/9952',
    },
  ];


  const announcements = [
    {
      tag: 'Recruitment',
      date: 'June 7, 2026',
      title: 'Elite Warrior Applications Now Open',
      body: 'W4U is selectively recruiting top-tier players. Minimum GS 180,000 required. Prove your worth.',
      color: '#D4AF37',
    },
    {
      tag: 'Event',
      date: 'June 5, 2026',
      title: 'Grand Territory War — Victory Secured',
      body: 'W4U dominated the Northern Territories for the 7th consecutive week. Unmatched. Unstoppable.',
      color: '#C0A060',
    },
    {
      tag: 'Guild News',
      date: 'June 1, 2026',
      title: 'Season 4 Rankings — W4U #1',
      body: 'We closed Season 4 ranked first in all major PvP categories. The standard has been set.',
      color: '#A08040',
    },
  ];

  return (
    <div style={{
      background: '#050508',
      color: '#e2e8f0',
      fontFamily: "'Inter', sans-serif",
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>

      {/* ── Loading Screen ── */}
      {!loaded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: '#030305',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '24px',
          transition: 'opacity 0.5s',
        }}>
          {/* Animated emblem */}
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid transparent',
              borderTopColor: '#D4AF37',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 8,
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '50%',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 900, letterSpacing: '-2px',
              background: 'linear-gradient(135deg, #D4AF37, #F0D060, #A87820)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>W4U</div>
          </div>
          <div style={{
            fontSize: 11, letterSpacing: '0.4em',
            color: 'rgba(212,175,55,0.5)',
            textTransform: 'uppercase',
          }}>Initializing Guild System</div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>

        {/* Particle canvas */}
        <canvas ref={canvasRef} style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Background layers */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 20% 80%, rgba(120,80,20,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 60%, rgba(80,40,10,0.08) 0%, transparent 50%),
            linear-gradient(180deg, #030305 0%, #080610 40%, #0a0810 70%, #050508 100%)
          `,
          zIndex: 0,
        }} />

        {/* Atmospheric fog */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
          background: 'linear-gradient(0deg, rgba(212,175,55,0.04) 0%, transparent 100%)',
          zIndex: 1,
          animation: 'fogPulse 6s ease-in-out infinite alternate',
        }} />

        {/* Top nav */}
        <nav style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(212,175,55,0.08)',
          backdropFilter: 'blur(8px)',
          background: 'rgba(5,5,8,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              border: '1.5px solid rgba(212,175,55,0.5)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900,
              background: 'linear-gradient(135deg, #D4AF37, #A87820)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>W4U</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color: '#e2e8f0' }}>WIPE4YOU</div>
              <div style={{ fontSize: 9, color: 'rgba(212,175,55,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Legend of Ymir</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <a href="https://discord.gg" target="_blank" rel="noreferrer" style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1px solid rgba(212,175,55,0.2)',
              background: 'rgba(212,175,55,0.05)',
              color: 'rgba(212,175,55,0.8)', fontSize: 12,
              fontWeight: 600, letterSpacing: '0.05em',
              textDecoration: 'none', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>Discord</a>
            <button onClick={onLogin} style={{
              padding: '8px 20px', borderRadius: 8,
              background: 'linear-gradient(135deg, #D4AF37, #A87820)',
              color: '#0a0810', fontSize: 12,
              fontWeight: 800, letterSpacing: '0.08em',
              border: 'none', cursor: 'pointer',
              textTransform: 'uppercase',
            }}>Sign In</button>
          </div>
        </nav>

        {/* Hero content */}
        <div style={{
          position: 'relative', zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          padding: '0 24px',
          transform: `translateY(${scrollY * 0.15}px)`,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease 0.3s',
        }}>

          {/* Emblem */}
          <div style={{ position: 'relative', marginBottom: 32 }}>
            {/* Outer ring */}
            <div style={{
              width: 160, height: 160,
              border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: '50%',
              position: 'absolute',
              top: -16, left: -16,
              animation: 'rotateSlow 30s linear infinite',
            }} />
            {/* Gold glow */}
            <div style={{
              width: 128, height: 128,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
              position: 'absolute', top: 0, left: 0,
            }} />
            {/* Main emblem */}
            <div style={{
              width: 128, height: 128,
              border: '2px solid rgba(212,175,55,0.6)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              background: 'rgba(10,8,16,0.9)',
              boxShadow: '0 0 40px rgba(212,175,55,0.15), inset 0 0 40px rgba(212,175,55,0.05)',
            }}>
              <span style={{
                fontSize: 48, fontWeight: 900,
                letterSpacing: '-3px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #F5E08A 40%, #D4AF37 60%, #A87820 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.4))',
              }}>W4U</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
          }}>
            <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5))' }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37' }} />
            <div style={{ fontSize: 10, letterSpacing: '0.4em', color: 'rgba(212,175,55,0.6)', textTransform: 'uppercase' }}>Legend of Ymir</div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37' }} />
            <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, rgba(212,175,55,0.5), transparent)' }} />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(48px, 8vw, 88px)',
            fontWeight: 900,
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: 16,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #C8B060 60%, #8A6020 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>WIPE4YOU</h1>

          {/* Tagline */}
          <p style={{
            fontSize: 'clamp(14px, 2.5vw, 20px)',
            fontWeight: 300,
            letterSpacing: '0.3em',
            color: 'rgba(212,175,55,0.7)',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}>Conquer. Dominate. Rule Ymir.</p>

          {/* Description */}
          <p style={{
            maxWidth: 520,
            fontSize: 16,
            lineHeight: 1.8,
            color: 'rgba(200,190,170,0.7)',
            marginBottom: 48,
          }}>
            One of the most competitive guilds in Legend of Ymir. Built for warriors,
            strategists, and champions seeking greatness.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={onLogin} style={{
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #D4AF37, #A87820)',
              color: '#0a0810',
              fontWeight: 800, fontSize: 13,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(212,175,55,0.3)',
              transition: 'all 0.3s',
            }}>⚔ Join W4U</button>

            <a href="https://discord.gg" target="_blank" rel="noreferrer" style={{
              padding: '16px 40px',
              background: 'transparent',
              color: '#D4AF37',
              fontWeight: 700, fontSize: 13,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              border: '1px solid rgba(212,175,55,0.4)',
              borderRadius: 4,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}>Discord Community</a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5, textAlign: 'center',
          opacity: scrollY > 50 ? 0 : 0.5,
          transition: 'opacity 0.3s',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#D4AF37', marginBottom: 8, textTransform: 'uppercase' }}>Scroll</div>
          <div style={{
            width: 1, height: 40,
            background: 'linear-gradient(180deg, rgba(212,175,55,0.6), transparent)',
            margin: '0 auto',
            animation: 'scrollPulse 2s ease-in-out infinite',
          }} />
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{
        padding: '100px 48px',
        background: 'linear-gradient(180deg, #050508 0%, #080612 50%, #050508 100%)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)',
        }} />

        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.5em',
              color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase',
              marginBottom: 12,
            }}>Guild Power</div>
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, letterSpacing: '-1px',
              background: 'linear-gradient(135deg, #FFFFFF, #C8B060)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 16,
            }}>Dominance by the Numbers</h2>
            <div style={{
              width: 60, height: 1,
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
              margin: '0 auto',
            }} />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 20,
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                padding: '36px 24px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(212,175,55,0.12)',
                borderRadius: 12,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'all 0.3s',
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.4)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(212,175,55,0.05)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(212,175,55,0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.12)';
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Top accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
                  background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)',
                }} />

                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                <div style={{
                  fontSize: 36, fontWeight: 900,
                  background: 'linear-gradient(135deg, #D4AF37, #F5E08A)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  marginBottom: 8, lineHeight: 1,
                }}>{s.value}</div>
                <div style={{
                  fontSize: 11, letterSpacing: '0.15em',
                  color: 'rgba(200,190,170,0.5)',
                  textTransform: 'uppercase',
                }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)',
        }} />
      </section>

      {/* ── ANNOUNCEMENTS ── */}
      <section style={{
        padding: '100px 48px',
        background: '#050508',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.5em',
              color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', marginBottom: 12,
            }}>Intelligence Board</div>
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, letterSpacing: '-1px',
              background: 'linear-gradient(135deg, #FFFFFF, #C8B060)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 16,
            }}>Latest Announcements</h2>
            <div style={{
              width: 60, height: 1,
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
              margin: '0 auto',
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {announcements.map((a, i) => (
              <div key={i} style={{
                padding: '32px 36px',
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(212,175,55,0.1)',
                borderRadius: 12,
                borderLeft: `3px solid ${a.color}`,
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.3s',
                cursor: 'default',
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(212,175,55,0.04)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.25)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{
                    padding: '3px 10px',
                    background: `rgba(212,175,55,0.12)`,
                    border: `1px solid rgba(212,175,55,0.25)`,
                    borderRadius: 4,
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#D4AF37',
                    textTransform: 'uppercase',
                  }}>{a.tag}</span>
                  <span style={{ fontSize: 12, color: 'rgba(200,190,170,0.4)' }}>{a.date}</span>
                </div>
                <h3 style={{
                  fontSize: 18, fontWeight: 700,
                  color: '#e2e8f0', marginBottom: 10, letterSpacing: '-0.3px',
                }}>{a.title}</h3>
                <p style={{
                  fontSize: 14, lineHeight: 1.7,
                  color: 'rgba(200,190,170,0.55)',
                }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUPPORT OUR STREAMERS ── */}
      <section style={{
        padding: '100px 48px',
        background: 'linear-gradient(180deg, #050508 0%, #080612 50%, #050508 100%)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)',
        }} />

        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.5em',
              color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', marginBottom: 12,
            }}>Represent W4U</div>
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, letterSpacing: '-1px',
              background: 'linear-gradient(135deg, #FFFFFF, #C8B060)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 16,
            }}>Support Our Streamers</h2>
            <p style={{
              fontSize: 15, color: 'rgba(200,190,170,0.55)',
              maxWidth: 480, margin: '0 auto', lineHeight: 1.7,
            }}>
              Our guild members streaming Legend of Ymir. Show them love and help grow the W4U name.
            </p>
            <div style={{
              width: 60, height: 1,
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
              margin: '24px auto 0',
            }} />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {streamers.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
                padding: '20px 28px',
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(168,120,32,0.04))',
                border: '1px solid rgba(212,175,55,0.2)',
                borderRadius: 999,
                transition: 'all 0.3s',
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.45)';
                  (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(212,175,55,0.16), rgba(168,120,32,0.06))';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.2)';
                  (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(168,120,32,0.04))';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(10,8,16,0.9)',
                    border: '1.5px solid rgba(212,175,55,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                  }}>⚔️</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 800, color: '#e2e8f0',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{s.name}</div>
                    <div style={{
                      fontSize: 11, color: 'rgba(212,175,55,0.6)',
                      letterSpacing: '0.05em',
                    }}>{s.game}</div>
                  </div>
                </div>

                <a
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flexShrink: 0,
                    padding: '10px 28px',
                    borderRadius: 999,
                    border: '1px solid rgba(212,175,55,0.5)',
                    color: '#D4AF37',
                    fontSize: 12, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    textDecoration: 'none',
                    background: 'transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #D4AF37, #A87820)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#0a0810';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#D4AF37';
                  }}
                >Support</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECRUITMENT BANNER ── */}
      <section style={{
        padding: '100px 48px',
        background: 'linear-gradient(180deg, #050508 0%, #0a0810 50%, #050508 100%)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)',
        }} />

        <div style={{
          maxWidth: 700, margin: '0 auto', textAlign: 'center',
          padding: '64px 48px',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: 16,
          background: 'rgba(212,175,55,0.03)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Corner accents */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
            <div key={pos} style={{
              position: 'absolute',
              ...(pos.includes('top') ? { top: -1 } : { bottom: -1 }),
              ...(pos.includes('left') ? { left: -1 } : { right: -1 }),
              width: 20, height: 20,
              border: `2px solid rgba(212,175,55,0.6)`,
              borderRadius: 2,
              ...(pos === 'top-left' ? { borderRight: 'none', borderBottom: 'none' } :
                pos === 'top-right' ? { borderLeft: 'none', borderBottom: 'none' } :
                pos === 'bottom-left' ? { borderRight: 'none', borderTop: 'none' } :
                { borderLeft: 'none', borderTop: 'none' }),
            }} />
          ))}

          <div style={{
            fontSize: 10, letterSpacing: '0.5em', textTransform: 'uppercase',
            color: 'rgba(212,175,55,0.5)', marginBottom: 16,
          }}>Elite Recruitment</div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800, letterSpacing: '-0.5px',
            color: '#e2e8f0', marginBottom: 16, lineHeight: 1.2,
          }}>Do You Have What It Takes?</h2>
          <p style={{
            fontSize: 15, lineHeight: 1.8,
            color: 'rgba(200,190,170,0.55)', marginBottom: 40,
          }}>
            W4U only accepts the strongest. We don't recruit for numbers — we recruit for excellence.
            If you're built for war, apply now.
          </p>
          <button onClick={onLogin} style={{
            padding: '16px 48px',
            background: 'linear-gradient(135deg, #D4AF37, #A87820)',
            color: '#0a0810',
            fontWeight: 800, fontSize: 13,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            border: 'none', borderRadius: 4,
            cursor: 'pointer',
            boxShadow: '0 0 40px rgba(212,175,55,0.2)',
          }}>Apply to W4U</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: '48px 48px 32px',
        borderTop: '1px solid rgba(212,175,55,0.08)',
        background: '#030305',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 32,
            marginBottom: 40,
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44,
                border: '1.5px solid rgba(212,175,55,0.4)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 900,
                background: 'linear-gradient(135deg, #D4AF37, #A87820)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>W4U</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>WIPE4YOU</div>
                <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Legend of Ymir</div>
              </div>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: 32 }}>
              {[
                { label: 'Discord', href: 'https://discord.gg' },
                { label: 'Dashboard', href: '#' },
                { label: 'Contact', href: '#' },
              ].map((link) => (
                <a key={link.label} href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  style={{
                    fontSize: 13, color: 'rgba(200,190,170,0.4)',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#D4AF37'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(200,190,170,0.4)'; }}
                >{link.label}</a>
              ))}
            </div>
          </div>

          <div style={{
            borderTop: '1px solid rgba(212,175,55,0.06)',
            paddingTop: 24,
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(200,190,170,0.25)' }}>
              © 2026 WIPE4YOU Guild. All rights reserved.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(212,175,55,0.3)', letterSpacing: '0.1em' }}>
              Conquer. Dominate. Rule Ymir.
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap');

        @keyframes rotateSlow {
          to { transform: rotate(360deg); }
        }
        @keyframes fogPulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.3; transform: scaleY(0.8); }
          50% { opacity: 0.8; transform: scaleY(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        button:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}

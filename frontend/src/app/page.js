'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  FiMessageCircle, FiShield, FiZap, FiUsers, FiCamera,
  FiPhone, FiLock, FiStar, FiArrowRight, FiChevronDown,
  FiSend, FiCheck, FiSmile, FiTrendingUp, FiClock, FiGlobe,
  FiGithub, FiTwitter, FiLinkedin, FiHeart
} from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import ChatApp from '../components/ChatApp';

// ─── DATA ──────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: FiSend, title: 'Instant Messaging', desc: 'Real-time chat with typing indicators, read receipts, reactions, and replies. Messages sync instantly across all your devices.' },
  { icon: FiPhone, title: 'Voice & Video Calls', desc: 'Crystal-clear WebRTC calls with screen sharing, group calling, and picture-in-picture mode. STUN/TURN optimized for any network.' },
  { icon: FiCamera, title: 'Stories & Status', desc: 'Share moments that disappear after 24 hours. Post photos, videos, or text stories with viewer insights and reactions.' },
  { icon: FiZap, title: 'AI Image Generation', desc: 'Built-in Nexus AI creates stunning visuals from text descriptions. Choose from realistic, fantasy, cyberpunk, and more art styles.' },
  { icon: FiUsers, title: 'Groups & Communities', desc: 'Discord-style servers with roles, channels, permissions, invite links, and powerful moderation tools for any community.' },
  { icon: FiLock, title: 'End-to-End Encryption', desc: 'Your conversations stay private with AES-GCM 256-bit encryption. Not even we can read your messages.' },
];

const STATS = [
  { value: '10K+', label: 'Active Users', icon: FiUsers },
  { value: '99.9%', label: 'Uptime', icon: FiTrendingUp },
  { value: '<50ms', label: 'Message Latency', icon: FiClock },
  { value: '50+', label: 'Countries', icon: FiGlobe },
];

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Product', href: '#product' },
  { label: 'About', href: '#about' },
];

// ─── ANIMATION VARIANTS ────────────────────────────────────────────────────

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.6 } } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } } };

const cardVariant = { hidden: { opacity: 0, y: 40, scale: 0.96 }, visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } }) };

// ─── COMPONENT ─────────────────────────────────────────────────────────────

function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient-dark)', overflowX: 'hidden', color: 'var(--text-dark)' }}>
      {/* ─── NAV ────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          padding: scrolled ? '12px 16px' : '20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'rgba(15,15,26,0.82)' : 'transparent',
          backdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'white', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
          }}>
            <FiZap />
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>Chatvora</span>
        </div>

        <div style={{ display: 'flex', gap: 32, alignItems: 'center', display: 'none', '@media (min-width: 768px)': { display: 'flex' } }}>
          {NAV_LINKS.map(link => (
            <button key={link.label} onClick={() => scrollTo(link.href.slice(1))}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--text-dark)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >{link.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/login')}
            style={{
              padding: '10px 22px', borderRadius: 8,
              background: 'transparent', color: 'var(--text-dark)',
              fontWeight: 600, fontSize: 14,
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
            }}
          >Sign In</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/login')}
            style={{
              padding: '10px 22px', borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              color: 'white', fontWeight: 600, fontSize: 14,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
            }}
          >Get Started</motion.button>
        </div>
      </motion.nav>

      {/* ─── HERO ───────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Animated background mesh */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '-20%', left: '-10%', width: '80%', height: '80%',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
            animation: 'heroOrbA 12s ease-in-out infinite alternate',
          }} />
          <div style={{
            position: 'absolute', bottom: '-20%', right: '-10%', width: '70%', height: '70%',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
            animation: 'heroOrbB 16s ease-in-out infinite alternate',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '60%', width: '50%', height: '50%',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%)',
            animation: 'heroOrbC 14s ease-in-out infinite alternate',
          }} />
          {/* Grid pattern overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        <motion.div style={{ opacity: heroOpacity, y: heroY, textAlign: 'center', padding: '140px 24px 80px', maxWidth: 900, position: 'relative', zIndex: 2 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} style={{ marginBottom: 28 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              color: '#a78bfa', fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
            }}>
              <FiZap size={14} /> Now with AI Image Generation
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
            style={{
              fontSize: 'clamp(40px, 8vw, 84px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-0.03em', marginBottom: 24,
            }}
          >
            Where{' '}
            <span style={{
              background: 'linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Conversations</span>
            <br />Come Alive
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
            style={{
              color: 'var(--text-muted)', fontSize: 'clamp(17px, 2vw, 21px)',
              maxWidth: 600, lineHeight: 1.65, margin: '0 auto 48px',
            }}
          >
            Chat, call, share, and create — all in one beautifully designed platform.
            Experience messaging reimagined with AI, encryption, and real-time sync.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
            style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push('/login')}
              style={{
                padding: '18px 42px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                color: 'white', fontWeight: 700, fontSize: 17,
                border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 20px rgba(99,102,241,0.2)',
              }}
            >
              Start Messaging <FiArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => scrollTo('features')}
              style={{
                padding: '18px 42px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', color: 'var(--text-dark)',
                fontWeight: 600, fontSize: 17,
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}
            >
              Explore Features <FiChevronDown size={18} />
            </motion.button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            style={{ marginTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {['End-to-end encrypted', 'Real-time sync', 'Open source'].map(badge => (
              <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                <FiCheck size={14} style={{ color: 'var(--success)' }} /> {badge}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'var(--text-muted)', opacity: 0.4, cursor: 'pointer' }}
          onClick={() => scrollTo('features')}
        >
          <FiChevronDown size={22} />
        </motion.div>
      </section>

      {/* ─── FEATURES ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '120px 24px' }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          style={{ textAlign: 'center', marginBottom: 72, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}
        >
          <motion.span variants={fadeUp} style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 999,
            background: 'rgba(99,102,241,0.1)', color: '#a78bfa',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
            marginBottom: 16,
          }}>Features</motion.span>
          <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Everything you need
          </motion.h2>
          <motion.p variants={fadeUp} style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.6 }}>
            One platform for messaging, calling, sharing, and creating.
          </motion.p>
        </motion.div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16, maxWidth: 1100, margin: '0 auto',
        }}>
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={cardVariant}
              whileHover={{ y: -6 }}
              style={{
                padding: '32px', borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.5))',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'default',
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
                color: '#a78bfa', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22, marginBottom: 20,
              }}>
                <feature.icon />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE ────────────────────────────────────────── */}
      <section id="product" style={{ padding: '80px 24px 120px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <motion.span variants={fadeUp} style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 999,
            background: 'rgba(99,102,241,0.1)', color: '#a78bfa',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
            marginBottom: 16,
          }}>Product</motion.span>
          <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            See it in action
          </motion.h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            maxWidth: 960, margin: '0 auto', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8))',
            overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Mock window chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Chatvora — Modern Real-Time Messaging</span>
          </div>

          {/* Mock chat UI */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 340 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '70%' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>J</div>
              <div style={{ padding: '10px 14px', borderRadius: '0 12px 12px 12px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-dark)' }}>Hey! Have you tried the new AI image generator?</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>2:41 PM</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '70%', marginLeft: 'auto', flexDirection: 'row-reverse' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Y</div>
              <div style={{ padding: '10px 14px', borderRadius: '12px 0 12px 12px', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white' }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>Not yet! Is it good?</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>2:42 PM</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '70%' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>J</div>
              <div style={{ padding: '10px 14px', borderRadius: '0 12px 12px 12px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-dark)' }}>It&apos;s incredible! I generated this with just a text description:</div>
                <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', width: 180, height: 120, background: 'linear-gradient(135deg, #6366f1, #a78bfa, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✨</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>2:43 PM</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── STATS ──────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px' }}>
        <div style={{
          maxWidth: 1000, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 24,
        }}>
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{ textAlign: 'center', padding: '24px 16px' }}
            >
              <stat.icon size={20} style={{ color: 'var(--primary)', marginBottom: 8, opacity: 0.6 }} />
              <div style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ──────────────────────────────────────────────── */}
      <section style={{ padding: '120px 24px', position: 'relative', textAlign: 'center' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 2 }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 16 }}
          >
            Ready to get started?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{ color: 'var(--text-muted)', fontSize: 18, maxWidth: 460, margin: '0 auto 40px', lineHeight: 1.6 }}
          >
            Join thousands of users who already enjoy premium, real-time messaging.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 40px rgba(99,102,241,0.35)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/login')}
            style={{
              padding: '20px 52px', borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              color: 'white', fontWeight: 700, fontSize: 18,
              border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 24px rgba(99,102,241,0.2)',
            }}
          >
            Create Free Account <FiArrowRight size={20} />
          </motion.button>
        </motion.div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 24px 32px',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 14, boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}><FiZap /></div>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Chatvora</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
              Premium real-time messaging platform with AI, calls, stories, and end-to-end encryption.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {[
              { title: 'Product', links: ['Features', 'Security', 'Pricing'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Support', links: ['Docs', 'Contact', 'Status'] },
            ].map(group => (
              <div key={group.title}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>{group.title}</div>
                {group.links.map(link => (
                  <div key={link} style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = 'var(--text-dark)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                  >{link}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 1000, margin: '40px auto 0', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>&copy; {new Date().getFullYear()} Chatvora. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)' }}>
            <FiHeart size={16} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#ef4444'} onMouseLeave={e => e.target.style.color = 'var(--text-muted)'} />
            <FiGithub size={16} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--text-dark)'} onMouseLeave={e => e.target.style.color = 'var(--text-muted)'} />
            <FiTwitter size={16} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#60a5fa'} onMouseLeave={e => e.target.style.color = 'var(--text-muted)'} />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── EXPORT ────────────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('accessToken');
    setHasToken(!!token);
    initialize();
  }, [initialize]);

  // Show landing page immediately for non-authenticated users
  // (no token = no need to wait for API call)
  if (!mounted) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--gradient-dark)'
      }}>
        <div className="skeleton" style={{ width: 60, height: 60, borderRadius: '50%' }} />
      </div>
    );
  }

  // If no token exists, skip loading entirely - show landing page instantly
  if (!hasToken) return <LandingPage />;

  // If we have a token, show a brief spinner while verifying
  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--gradient-dark)'
      }}>
        <div className="skeleton" style={{ width: 60, height: 60, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!isAuthenticated) return <LandingPage />;
  return <ChatApp />;
}

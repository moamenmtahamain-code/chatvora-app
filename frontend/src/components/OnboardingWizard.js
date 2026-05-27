'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiZap, FiPhone, FiMessageCircle, FiUser, FiCpu,
  FiArrowRight, FiArrowLeft, FiCheck, FiX
} from 'react-icons/fi';
import { useOnboardingStore } from '../stores/onboardingStore';
import Button from './ui/Button';

const STEP_ICONS = [FiZap, FiUser, FiMessageCircle, FiPhone, FiCpu];

const fadeVariants = {
  enter: { opacity: 0, x: 40, scale: 0.97 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.97 },
};

export default function OnboardingWizard({ onComplete }) {
  const { currentStep, steps, nextStep, prevStep, skip, markComplete } = useOnboardingStore();
  const [direction, setDirection] = useState(1);

  const step = steps[currentStep];
  const Icon = STEP_ICONS[currentStep] || FiZap;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    setDirection(1);
    if (isLast) {
      markComplete();
      onComplete?.();
    } else {
      nextStep();
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    prevStep();
  };

  const handleSkip = () => {
    skip();
    onComplete?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          width: '100%', maxWidth: 440,
          background: 'linear-gradient(180deg, rgba(30,41,59,0.98), rgba(15,23,42,0.98))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: `${((currentStep) / steps.length) * 100}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
              borderRadius: '0 2px 2px 0',
            }}
          />
        </div>

        {/* Skip button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <button onClick={handleSkip}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.color = 'var(--text-dark)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}
          >
            <FiX size={14} /> Skip
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 32px 32px', minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
            >
              {/* Icon */}
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a78bfa', fontSize: 30, marginBottom: 24,
              }}>
                <Icon />
              </div>

              {/* Step indicator */}
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Step {currentStep + 1} of {steps.length}
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: 24, fontWeight: 700, margin: '0 0 12px',
                letterSpacing: '-0.02em',
              }}>
                {step.title}
              </h2>

              {/* Description */}
              <p style={{
                fontSize: 15, color: 'var(--text-muted)',
                lineHeight: 1.6, maxWidth: 320, margin: 0,
              }}>
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', marginTop: 'auto', paddingTop: 32, gap: 12,
          }}>
            {currentStep > 0 ? (
              <Button variant="secondary" icon={<FiArrowLeft />} onClick={handlePrev}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <Button icon={isLast ? <FiCheck /> : <FiArrowRight />} onClick={handleNext}>
              {isLast ? 'Get Started' : 'Continue'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

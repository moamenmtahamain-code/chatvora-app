import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STEPS = [
  { key: 'welcome', title: 'Welcome to ChatWave', description: 'Premium real-time messaging with AI, calls, and encryption.' },
  { key: 'profile', title: 'Set Up Your Profile', description: 'Add a photo, display name, and bio so friends can find you.' },
  { key: 'message', title: 'Send Your First Message', description: 'Start a conversation with a friend or create a group.' },
  { key: 'calls', title: 'Make a Call', description: 'Use voice or video calls with crystal-clear WebRTC audio.' },
  { key: 'ai', title: 'Explore AI Features', description: 'Generate images from text with Nexus AI.' },
];

export const useOnboardingStore = create(
  persist(
    (set, get) => ({
      completed: false,
      currentStep: 0,
      skipped: false,
      steps: STEPS,

      markComplete: () => set({ completed: true, currentStep: STEPS.length }),
      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < STEPS.length - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          set({ completed: true });
        }
      },
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) set({ currentStep: currentStep - 1 });
      },
      skip: () => set({ completed: true, skipped: true }),
      reset: () => set({ completed: false, currentStep: 0, skipped: false }),
    }),
    { name: 'chatwave-onboarding' }
  )
);

export default useOnboardingStore;

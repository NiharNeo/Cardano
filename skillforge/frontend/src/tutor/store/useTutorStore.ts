
import { create } from 'zustand';

export interface AvailabilitySlot {
    day: string;
    from: string;
    to: string;
}

export interface TutorProfile {
    id?: string;
    name: string;
    bio: string;
    skills: string[];
    rateADA: number;
    minDuration: number;
    maxDuration: number;
    availability: AvailabilitySlot[];
    walletAddress: string;
    certifications: string[];
}

interface TutorState {
    profile: TutorProfile;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // Actions
    setProfile: (profile: Partial<TutorProfile>) => void;
    addSkill: (skill: string) => void;
    removeSkill: (skill: string) => void;
    addAvailability: (slot: AvailabilitySlot) => void;
    removeAvailability: (index: number) => void;
    fetchProfile: (walletAddress: string) => Promise<void>;
    saveProfile: () => Promise<void>;
    reset: () => void;
}

const INITIAL_PROFILE: TutorProfile = {
    name: '',
    bio: '',
    skills: [],
    rateADA: 50,
    minDuration: 30,
    maxDuration: 120,
    availability: [],
    walletAddress: '',
    certifications: []
};

export const useTutorStore = create<TutorState>((set, get) => ({
    profile: INITIAL_PROFILE,
    isLoading: false,
    isSaving: false,
    error: null,

    setProfile: (updates) => set((state) => ({
        profile: { ...state.profile, ...updates }
    })),

    addSkill: (skill) => set((state) => {
        if (state.profile.skills.includes(skill)) return state;
        return { profile: { ...state.profile, skills: [...state.profile.skills, skill] } };
    }),

    removeSkill: (skill) => set((state) => ({
        profile: { ...state.profile, skills: state.profile.skills.filter(s => s !== skill) }
    })),

    addAvailability: (slot) => set((state) => ({
        profile: { ...state.profile, availability: [...state.profile.availability, slot] }
    })),

    removeAvailability: (index) => set((state) => ({
        profile: { ...state.profile, availability: state.profile.availability.filter((_, i) => i !== index) }
    })),

    fetchProfile: async (walletAddress) => {
        if (!walletAddress) return;
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`http://localhost:3000/tutors/${walletAddress}`);
            if (response.ok) {
                const data = await response.json();
                set({ profile: data });
            } else {
                // If 404, just keep initial profile but set wallet address
                set((state) => ({ profile: { ...state.profile, walletAddress } }));
            }
        } catch (err: any) {
            console.error('Error fetching profile:', err);
            set({ error: 'Failed to load profile' });
        } finally {
            set({ isLoading: false });
        }
    },

    saveProfile: async () => {
        const { profile } = get();
        if (!profile.walletAddress) {
            set({ error: 'Wallet not connected' });
            return;
        }

        set({ isSaving: true, error: null });
        try {
            const response = await fetch('http://localhost:3000/tutors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });

            if (!response.ok) throw new Error('Failed to save');

            const data = await response.json();
            set({ profile: data.tutor }); // Update with server response (e.g. timestamps)
        } catch (err: any) {
            console.error('Error saving profile:', err);
            set({ error: 'Failed to save profile' });
        } finally {
            set({ isSaving: false });
        }
    },

    reset: () => set({ profile: INITIAL_PROFILE, error: null })
}));

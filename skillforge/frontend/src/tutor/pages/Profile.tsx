
import React from 'react';
import { useTutorStore } from '../store/useTutorStore';
import { Save } from 'lucide-react';

const Profile: React.FC = () => {
    const { profile, setProfile, saveProfile, isSaving, error } = useTutorStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveProfile();
    };

    return (
        <div className="max-w-2xl">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-100">Edit Profile</h1>
                <p className="text-gray-400">Manage your public information and rates.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6 card">
                {error && (
                    <div className="p-4 bg-red-900/20 text-red-400 rounded-lg text-sm border border-red-800/50">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ name: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-100 placeholder-gray-600"
                            placeholder="e.g. Alice Baker"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Bio / Description</label>
                        <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile({ bio: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-100 placeholder-gray-600"
                            placeholder="Tell learners about your expertise..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Hourly Rate (ADA)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">₳</span>
                                <input
                                    type="number"
                                    value={profile.rateADA}
                                    onChange={(e) => setProfile({ rateADA: Number(e.target.value) })}
                                    className="w-full pl-8 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-100"
                                    min="1"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Min Duration (min)</label>
                            <input
                                type="number"
                                value={profile.minDuration}
                                onChange={(e) => setProfile({ minDuration: Number(e.target.value) })}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-100"
                                step="15"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Max Duration (min)</label>
                            <input
                                type="number"
                                value={profile.maxDuration}
                                onChange={(e) => setProfile({ maxDuration: Number(e.target.value) })}
                                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-100"
                                step="15"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} className="mr-2" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Profile;


import React, { useState } from 'react';
import { useTutorStore } from '../store/useTutorStore';
import { X, Plus, Save } from 'lucide-react';

const Skills: React.FC = () => {
    const { profile, addSkill, removeSkill, saveProfile, isSaving } = useTutorStore();
    const [newSkill, setNewSkill] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSkill.trim()) {
            addSkill(newSkill.trim());
            setNewSkill('');
        }
    };

    return (
        <div className="max-w-2xl">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-100">My Skills</h1>
                <p className="text-gray-400">Add skills to help learners find you. Be specific!</p>
            </header>

            <div className="card space-y-6">
                <form onSubmit={handleAdd} className="flex gap-2">
                    <input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-100 placeholder-gray-600"
                        placeholder="e.g. Plutus, React, Tokenomics"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg font-medium transition-colors flex items-center"
                    >
                        <Plus size={20} />
                    </button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {profile.skills.length === 0 && (
                        <p className="text-gray-500 italic">No skills added yet.</p>
                    )}
                    {profile.skills.map((skill) => (
                        <span key={skill} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900/30 text-blue-300 text-sm font-medium border border-blue-800/50">
                            {skill}
                            <button
                                onClick={() => removeSkill(skill)}
                                className="ml-2 p-0.5 hover:bg-blue-800/50 rounded-full transition-colors text-blue-400"
                            >
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end">
                    <button
                        onClick={() => saveProfile()}
                        disabled={isSaving}
                        className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/30 disabled:opacity-50"
                    >
                        <Save size={18} className="mr-2" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Skills;

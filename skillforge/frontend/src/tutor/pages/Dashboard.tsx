
import React from 'react';
import { useTutorStore } from '../store/useTutorStore';
import { CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const { profile, isLoading } = useTutorStore();

    const isProfileComplete = profile.name && profile.skills.length > 0 && profile.availability.length > 0;

    if (isLoading) return <div className="text-gray-400">Loading...</div>;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
                <p className="text-gray-400">Welcome back, {profile.name || 'Tutor'}. Here's what's happening.</p>
            </header>

            {/* Status Card */}
            <div className={`p-6 rounded-xl border ${isProfileComplete ? 'bg-green-900/10 border-green-800/50' : 'bg-amber-900/10 border-amber-800/50'}`}>
                <div className="flex items-start">
                    {isProfileComplete ? (
                        <CheckCircle className="text-green-500 mt-1 mr-4" size={24} />
                    ) : (
                        <AlertCircle className="text-amber-500 mt-1 mr-4" size={24} />
                    )}
                    <div>
                        <h3 className={`text-lg font-semibold ${isProfileComplete ? 'text-green-400' : 'text-amber-400'}`}>
                            {isProfileComplete ? 'Profile Active & Visible' : 'Complete Your Profile'}
                        </h3>
                        <p className={`mt-1 ${isProfileComplete ? 'text-green-300/80' : 'text-amber-300/80'}`}>
                            {isProfileComplete
                                ? 'Great job! Your profile is live and visible to learners on SkillForge.'
                                : 'You need to complete your profile details, add skills, and set availability to be listed.'}
                        </p>
                        {!isProfileComplete && (
                            <div className="mt-4 flex space-x-3">
                                {!profile.name && <Link to="/tutor/profile" className="text-sm font-medium text-amber-400 hover:text-amber-300 underline">Add Details</Link>}
                                {profile.skills.length === 0 && <Link to="/tutor/skills" className="text-sm font-medium text-amber-400 hover:text-amber-300 underline">Add Skills</Link>}
                                {profile.availability.length === 0 && <Link to="/tutor/availability" className="text-sm font-medium text-amber-400 hover:text-amber-300 underline">Set Availability</Link>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-400">Hourly Rate</h3>
                        <span className="p-2 bg-blue-900/30 text-blue-400 rounded-lg">₳</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-100">{profile.rateADA} <span className="text-lg font-normal text-gray-500">ADA</span></div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-400">Total Skills</h3>
                        <TrendingUp size={20} className="text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold text-gray-100">{profile.skills.length}</div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-400">Availability</h3>
                        <Clock size={20} className="text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-gray-100">{profile.availability.length} <span className="text-lg font-normal text-gray-500">slots</span></div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

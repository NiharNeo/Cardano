
import React, { useState } from 'react';
import { useTutorStore } from '../store/useTutorStore';
import { X, Plus, Save } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Availability: React.FC = () => {
    const { profile, addAvailability, removeAvailability, saveProfile, isSaving } = useTutorStore();
    const [day, setDay] = useState(DAYS[0]);
    const [from, setFrom] = useState('09:00');
    const [to, setTo] = useState('17:00');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        addAvailability({ day, from, to });
    };

    return (
        <div className="max-w-2xl">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-100">Availability</h1>
                <p className="text-gray-400">Set your weekly recurring availability.</p>
            </header>

            <div className="card space-y-6">
                <form onSubmit={handleAdd} className="grid grid-cols-4 gap-4 items-end">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-400 mb-1">Day</label>
                        <select
                            value={day}
                            onChange={(e) => setDay(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-100"
                        >
                            {DAYS.map(d => <option key={d} value={d} className="bg-gray-900">{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">From</label>
                        <input
                            type="time"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">To</label>
                        <input
                            type="time"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-100"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center col-span-4 mt-2"
                    >
                        <Plus size={20} className="mr-2" /> Add Slot
                    </button>
                </form>

                <div className="space-y-2">
                    {profile.availability.length === 0 && (
                        <p className="text-gray-500 italic text-center py-4">No availability slots added.</p>
                    )}
                    {profile.availability.map((slot, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                            <div className="flex items-center space-x-4">
                                <span className="font-medium text-gray-200 w-24">{slot.day}</span>
                                <span className="text-gray-400">{slot.from} - {slot.to}</span>
                            </div>
                            <button
                                onClick={() => removeAvailability(index)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
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

export default Availability;

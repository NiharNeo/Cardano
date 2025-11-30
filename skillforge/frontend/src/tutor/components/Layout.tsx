import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Zap, Calendar, LogOut, Wallet } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useTutorStore } from '../store/useTutorStore';

const TutorLayout: React.FC = () => {
    const { isConnected, wallet, connect, disconnect, availableWallets, paymentAddress } = useWallet();
    const { fetchProfile, reset, profile } = useTutorStore();
    const navigate = useNavigate();
    const [showConnectModal, setShowConnectModal] = useState(false);

    useEffect(() => {
        if (isConnected && paymentAddress) {
            fetchProfile(paymentAddress);
        } else {
            reset();
        }
    }, [isConnected, paymentAddress, fetchProfile, reset]);

    const handleConnect = async (walletName: string) => {
        try {
            await connect(walletName as any);
            setShowConnectModal(false);
        } catch (e) {
            console.error(e);
        }
    };

    // Get list of installed wallets
    const installedWallets = Object.keys(availableWallets).filter(key => availableWallets[key as keyof typeof availableWallets]);

    return (
        <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        SkillForge Tutor
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <NavLink
                        to="/tutor"
                        end
                        className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-900/20 text-blue-400 font-medium border border-blue-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <LayoutDashboard size={20} className="mr-3" />
                        Dashboard
                    </NavLink>
                    <NavLink
                        to="/tutor/profile"
                        className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-900/20 text-blue-400 font-medium border border-blue-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <User size={20} className="mr-3" />
                        Profile
                    </NavLink>
                    <NavLink
                        to="/tutor/skills"
                        className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-900/20 text-blue-400 font-medium border border-blue-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <Zap size={20} className="mr-3" />
                        My Skills
                    </NavLink>
                    <NavLink
                        to="/tutor/availability"
                        className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-900/20 text-blue-400 font-medium border border-blue-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    >
                        <Calendar size={20} className="mr-3" />
                        Availability
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    {isConnected ? (
                        <div className="space-y-3">
                            <div className="flex items-center px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-medium text-gray-300 truncate">{profile.name || 'Connected'}</div>
                                    <div className="text-xs text-gray-500 truncate">{paymentAddress?.slice(0, 10)}...{paymentAddress?.slice(-4)}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => disconnect()}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <LogOut size={18} className="mr-2" />
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowConnectModal(true)}
                                className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center"
                            >
                                <Wallet size={18} className="mr-2" />
                                Connect Wallet
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 w-full text-xs text-center text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        ← Back to Learner App
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black relative">
                <div className="max-w-5xl mx-auto p-8">
                    <Outlet />
                </div>

                {/* Wallet Modal */}
                {showConnectModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <h2 className="text-xl font-bold text-gray-100 mb-4">Select Wallet</h2>
                            <div className="space-y-3">
                                {installedWallets.length > 0 ? (
                                    installedWallets.map(name => (
                                        <button
                                            key={name}
                                            onClick={() => handleConnect(name)}
                                            className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-all group"
                                        >
                                            <span className="capitalize font-medium text-gray-200">{name}</span>
                                            <div className="w-2 h-2 rounded-full bg-gray-600 group-hover:bg-green-500 transition-colors" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-gray-400">
                                        No wallets detected. Please install Eternl, Nami, or Lace.
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowConnectModal(false)}
                                className="mt-6 w-full py-2 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TutorLayout;

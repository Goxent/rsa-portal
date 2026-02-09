import React, { useState, useEffect } from 'react';
import { Send, Hash, Users, Plus, Settings, X, UserPlus, UserMinus, Lock, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatChannel, ChatMessage } from '../types/advanced';
import { UserProfile, UserRole } from '../types';
import { ChatService } from '../services/advanced';
import { AuthService } from '../services/firebase';

const TeamChatPage: React.FC = () => {
    const { user } = useAuth();
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

    // Modal states
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    const [isChannelSettings, setIsChannelSettings] = useState(false);
    const [showMemberSelector, setShowMemberSelector] = useState(false);

    // Channel creation form
    const [newChannel, setNewChannel] = useState({
        name: '',
        description: '',
        type: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
        members: [] as string[],
    });

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    useEffect(() => {
        if (user) {
            initializeUserChat();
            loadChannels();
            loadUsers();
        }
    }, [user]);

    const initializeUserChat = async () => {
        if (!user) return;

        try {
            // Ensure general channel exists
            await ChatService.ensureGeneralChannel(user.uid);

            // Add user to all public channels
            await ChatService.addUserToPublicChannels(user.uid);
        } catch (error) {
            console.error('Error initializing user chat:', error);
        }
    };

    useEffect(() => {
        if (!selectedChannel) return;
        const unsubscribe = ChatService.subscribeToMessages(selectedChannel.id, (msgs) => {
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, [selectedChannel]);

    const loadChannels = async () => {
        if (!user) return;
        const data = await ChatService.getChannels(user.uid);
        setChannels(data);
        if (data.length > 0 && !selectedChannel) {
            setSelectedChannel(data[0]);
        }
    };

    const loadUsers = async () => {
        const users = await AuthService.getAllUsers();
        setAllUsers(users);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedChannel || !user) return;

        await ChatService.sendMessage({
            channelId: selectedChannel.id,
            senderId: user.uid,
            senderName: user.displayName || 'User',
            content: newMessage,
            timestamp: new Date().toISOString(),
            readBy: [user.uid],
        });

        setNewMessage('');
    };

    const handleCreateChannel = async () => {
        if (!newChannel.name.trim() || !user || !isAdmin) return;

        const channelData: Omit<ChatChannel, 'id'> = {
            name: newChannel.name,
            description: newChannel.description,
            type: newChannel.type,
            members: newChannel.type === 'PUBLIC'
                ? allUsers.map(u => u.uid) // Public: all users auto-added
                : [...newChannel.members, user.uid], // Private: selected members + creator
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        };

        await ChatService.createChannel(channelData);
        setNewChannel({ name: '', description: '', type: 'PUBLIC', members: [] });
        setIsCreatingChannel(false);
        await loadChannels();
    };

    const handleAddMember = async (userId: string) => {
        if (!selectedChannel || !isAdmin) return;

        const updatedMembers = [...selectedChannel.members, userId];
        await ChatService.updateChannel(selectedChannel.id, { members: updatedMembers });
        await loadChannels();
        setShowMemberSelector(false);
    };

    const handleRemoveMember = async (userId: string) => {
        if (!selectedChannel || !isAdmin) return;
        if (userId === selectedChannel.createdBy) {
            alert('Cannot remove channel creator');
            return;
        }

        const updatedMembers = selectedChannel.members.filter(m => m !== userId);
        await ChatService.updateChannel(selectedChannel.id, { members: updatedMembers });
        await loadChannels();
    };

    const handleDeleteChannel = async () => {
        if (!selectedChannel || !isAdmin) return;
        if (!confirm(`Delete channel #${selectedChannel.name}?`)) return;

        await ChatService.deleteChannel(selectedChannel.id);
        setSelectedChannel(null);
        setIsChannelSettings(false);
        await loadChannels();
    };

    const toggleMemberInNew = (userId: string) => {
        if (newChannel.members.includes(userId)) {
            setNewChannel({ ...newChannel, members: newChannel.members.filter(m => m !== userId) });
        } else {
            setNewChannel({ ...newChannel, members: [...newChannel.members, userId] });
        }
    };

    const getMemberName = (userId: string) => {
        const userProfile = allUsers.find(u => u.uid === userId);
        return userProfile?.displayName || 'User';
    };

    const nonMembers = allUsers.filter(u => !selectedChannel?.members.includes(u.uid));

    return (
        <div className="h-[calc(100vh-120px)] flex gap-4">
            {/* Sidebar */}
            <div className="w-72 glass-panel rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-white">Channels</h2>
                    {isAdmin && (
                        <button
                            onClick={() => setIsCreatingChannel(true)}
                            className="p-1.5 hover:bg-white/10 rounded text-blue-400 hover:text-blue-300"
                            title="Create Channel (Admin Only)"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => setSelectedChannel(channel)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center space-x-2 transition-colors ${selectedChannel?.id === channel.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {channel.type === 'PRIVATE' ? <Lock size={14} /> : <Hash size={14} />}
                            <span className="truncate flex-1">{channel.name}</span>
                            <span className="text-xs text-gray-500">{channel.members.length}</span>
                        </button>
                    ))}
                    {channels.length === 0 && (
                        <div className="text-center text-gray-500 text-sm py-8">
                            No channels yet
                            {isAdmin && (
                                <p className="text-xs mt-2">Click + to create one</p>
                            )}
                        </div>
                    )}
                </div>

                {!isAdmin && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-xs text-amber-300">💡 Only admins can create channels</p>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 glass-panel rounded-xl flex flex-col">
                {selectedChannel ? (
                    <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                {selectedChannel.type === 'PRIVATE' ? (
                                    <Lock className="text-gray-400" size={20} />
                                ) : (
                                    <Hash className="text-gray-400" size={20} />
                                )}
                                <div>
                                    <h3 className="font-bold text-white">{selectedChannel.name}</h3>
                                    {selectedChannel.description && (
                                        <p className="text-xs text-gray-500">{selectedChannel.description}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setIsChannelSettings(true)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                            >
                                <Settings size={18} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className="flex space-x-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {msg.senderName[0]}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-baseline space-x-2">
                                            <span className="font-medium text-white">{msg.senderName}</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-300 mt-1">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-center text-gray-500 py-8">
                                    <Hash size={48} className="mx-auto mb-2 opacity-30" />
                                    <p>Start the conversation in #{selectedChannel.name}!</p>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    placeholder={`Message #${selectedChannel.name}`}
                                    className="flex-1 rounded-lg px-4 py-2.5"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim()}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <Users size={64} className="mx-auto mb-4 opacity-30" />
                            <p>Select a channel to start chatting</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Channel Modal */}
            {isCreatingChannel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between sticky top-0">
                            <h3 className="text-lg font-bold text-white">Create New Channel</h3>
                            <button onClick={() => setIsCreatingChannel(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Channel Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. general, announcements"
                                    className="w-full rounded-lg px-3 py-2"
                                    value={newChannel.name}
                                    onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description (Optional)</label>
                                <textarea
                                    className="w-full rounded-lg px-3 py-2"
                                    rows={2}
                                    placeholder="What's this channel about?"
                                    value={newChannel.description}
                                    onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Channel Type</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setNewChannel({ ...newChannel, type: 'PUBLIC' })}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${newChannel.type === 'PUBLIC'
                                            ? 'border-blue-500 bg-blue-500/20 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <Globe size={20} className="mx-auto mb-1" />
                                        <p className="text-xs font-medium">Public</p>
                                        <p className="text-[10px] mt-1 opacity-70">All team members</p>
                                    </button>
                                    <button
                                        onClick={() => setNewChannel({ ...newChannel, type: 'PRIVATE' })}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${newChannel.type === 'PRIVATE'
                                            ? 'border-blue-500 bg-blue-500/20 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <Lock size={20} className="mx-auto mb-1" />
                                        <p className="text-xs font-medium">Private</p>
                                        <p className="text-[10px] mt-1 opacity-70">Selected members</p>
                                    </button>
                                </div>
                            </div>

                            {newChannel.type === 'PRIVATE' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Select Members ({newChannel.members.length} selected)
                                    </label>
                                    <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg">
                                        {allUsers.filter(u => u.uid !== user?.uid).map((u) => (
                                            <label
                                                key={u.uid}
                                                className="flex items-center space-x-3 px-3 py-2 hover:bg-white/5 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={newChannel.members.includes(u.uid)}
                                                    onChange={() => toggleMemberInNew(u.uid)}
                                                    className="rounded"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm text-white">{u.displayName}</p>
                                                    <p className="text-xs text-gray-500">{u.role}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCreateChannel}
                                disabled={!newChannel.name.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Channel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Channel Settings Modal */}
            {isChannelSettings && selectedChannel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between sticky top-0">
                            <h3 className="text-lg font-bold text-white">#{selectedChannel.name} Settings</h3>
                            <button onClick={() => setIsChannelSettings(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Channel Info */}
                            <div>
                                <h4 className="font-bold text-white mb-2">Channel Information</h4>
                                <div className="glass-panel p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Type:</span>
                                        <span className="text-white flex items-center gap-1">
                                            {selectedChannel.type === 'PRIVATE' ? (
                                                <><Lock size={14} /> Private</>
                                            ) : (
                                                <><Globe size={14} /> Public</>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Created:</span>
                                        <span className="text-white">
                                            {new Date(selectedChannel.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Creator:</span>
                                        <span className="text-white">{getMemberName(selectedChannel.createdBy)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Members */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-white">
                                        Members ({selectedChannel.members.length})
                                    </h4>
                                    {isAdmin && nonMembers.length > 0 && (
                                        <button
                                            onClick={() => setShowMemberSelector(!showMemberSelector)}
                                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <UserPlus size={14} /> Add Member
                                        </button>
                                    )}
                                </div>

                                {/* Add Member Dropdown */}
                                {showMemberSelector && isAdmin && (
                                    <div className="mb-4 glass-panel p-3 rounded-lg max-h-48 overflow-y-auto">
                                        {nonMembers.map((u) => (
                                            <button
                                                key={u.uid}
                                                onClick={() => handleAddMember(u.uid)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded text-left"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                                                    {u.displayName[0]}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-white">{u.displayName}</p>
                                                    <p className="text-xs text-gray-500">{u.role}</p>
                                                </div>
                                                <UserPlus size={16} className="text-green-400" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Member List */}
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {selectedChannel.members.map((memberId) => (
                                        <div
                                            key={memberId}
                                            className="flex items-center justify-between glass-panel p-3 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                                    {getMemberName(memberId)[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm text-white font-medium">{getMemberName(memberId)}</p>
                                                    {memberId === selectedChannel.createdBy && (
                                                        <p className="text-xs text-blue-400">Creator</p>
                                                    )}
                                                </div>
                                            </div>
                                            {isAdmin && memberId !== selectedChannel.createdBy && (
                                                <button
                                                    onClick={() => handleRemoveMember(memberId)}
                                                    className="text-red-400 hover:text-red-300 p-1"
                                                    title="Remove member"
                                                >
                                                    <UserMinus size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Danger Zone */}
                            {isAdmin && (
                                <div>
                                    <h4 className="font-bold text-red-400 mb-2">Danger Zone</h4>
                                    <button
                                        onClick={handleDeleteChannel}
                                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-lg font-medium"
                                    >
                                        Delete Channel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamChatPage;

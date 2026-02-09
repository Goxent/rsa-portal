import React, { useState, useEffect } from 'react';
import { Send, Hash, Users, Plus, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatChannel, ChatMessage } from '../types/advanced';
import { ChatService } from '../services/advanced';

const TeamChatPage: React.FC = () => {
    const { user } = useAuth();
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');

    useEffect(() => {
        if (user) loadChannels();
    }, [user]);

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
        if (!newChannelName.trim() || !user) return;

        const id = await ChatService.createChannel({
            name: newChannelName,
            type: 'PUBLIC',
            members: [user.uid],
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        });

        setNewChannelName('');
        setIsCreatingChannel(false);
        await loadChannels();
    };

    return (
        <div className="h-[calc(100vh-120px)] flex gap-4">
            {/* Sidebar */}
            <div className="w-64 glass-panel rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-white">Channels</h2>
                    <button
                        onClick={() => setIsCreatingChannel(true)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {isCreatingChannel && (
                    <div className="mb-4 space-y-2">
                        <input
                            type="text"
                            placeholder="Channel name"
                            className="w-full rounded px-2 py-1 text-sm"
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreateChannel}
                                className="flex-1 bg-blue-600 text-white text-xs px-2 py-1 rounded"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => setIsCreatingChannel(false)}
                                className="flex-1 bg-gray-700 text-white text-xs px-2 py-1 rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-1 flex-1 overflow-y-auto">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => setSelectedChannel(channel)}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${selectedChannel?.id === channel.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            <Hash size={16} />
                            <span className="truncate">{channel.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 glass-panel rounded-xl flex flex-col">
                {selectedChannel ? (
                    <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                            <div className="flex items-center space-x-2">
                                <Hash className="text-gray-400" size={20} />
                                <h3 className="font-bold text-white">{selectedChannel.name}</h3>
                                <span className="text-sm text-gray-500">
                                    {selectedChannel.members.length} members
                                </span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className="flex space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {msg.senderName[0]}
                                    </div>
                                    <div>
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
                                    <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    placeholder={`Message #${selectedChannel.name}`}
                                    className="flex-1 rounded-lg px-4 py-2"
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
        </div>
    );
};

export default TeamChatPage;

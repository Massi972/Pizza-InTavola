import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/db';
import { User, Role } from '../types';
import { Trash2, Bell, RefreshCw } from '../components/Icons';

interface Message {
  id: string;
  title: string;
  body: string;
  sent_by: string | null;
  sent_at: string;
}

interface MessagesBoardProps {
  user: User;
  onBack: () => void;
}

const MessagesBoard: React.FC<MessagesBoardProps> = ({ user, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isAdmin = user.role === Role.ADMIN;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('sent_at', { ascending: false });
    if (!error && data) setMessages(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();

    // Aggiornamento in tempo reale
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('messages').delete().eq('id', id);
    setDeleting(null);
    fetchMessages();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays === 1) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="ios-blur sticky top-0 z-30 border-b border-[#C6C6C8]/50 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={onBack} className="text-[#007AFF] font-medium text-sm">
            ← Indietro
          </button>
          <h1 className="flex-1 text-center font-bold text-[#1c1c1e] text-lg">📬 Messaggi</h1>
          <button onClick={fetchMessages} className="text-[#007AFF]">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Lista messaggi */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <div className="max-w-lg mx-auto space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={28} className="animate-spin text-[#8E8E93]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={40} className="mx-auto text-[#C6C6C8] mb-4" />
              <p className="text-[#8E8E93] font-medium">Nessun messaggio</p>
              <p className="text-[#C6C6C8] text-sm mt-1">I messaggi inviati appariranno qui</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-[#F2F2F7]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1c1c1e] text-sm">{msg.title}</p>
                    <p className="text-sm text-[#3C3C43] mt-1 leading-relaxed">{msg.body}</p>
                    <p className="text-xs text-[#8E8E93] mt-2">{formatDate(msg.sent_at)}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      disabled={deleting === msg.id}
                      className="shrink-0 p-2 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] active:scale-95 transition-all disabled:opacity-40"
                    >
                      {deleting === msg.id
                        ? <RefreshCw size={16} className="animate-spin" />
                        : <Trash2 size={16} />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesBoard;

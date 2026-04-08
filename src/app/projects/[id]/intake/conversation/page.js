'use client';

import { useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Input } from '@/components/ui';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Loader2, 
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function ConversationIntake() {
  const { id } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [round, setRound] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef(null);
  const [error, setError] = useState(null);
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);
  const timeoutRef = useRef(null);

  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    async function startConversation() {
      try {
        const response = await fetch('/api/intake/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id }),
        });
        const data = await response.json();
        if (data.success) {
          const convo = data.data;
          setConversationId(convo._id);
          if (convo.messages && convo.messages.length > 0) {
            setMessages(convo.messages);
          }
          setRound(convo.followUpRound || 1);
        }
      } catch (error) {
        console.error('Failed to start conversation:', error);
      } finally {
        setIsLoading(false);
      }
    }

    startConversation();
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSending || isDone || !conversationId) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const response = await fetch('/api/intake/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: userMessage }),
      });
      const data = await response.json();
      
      if (data.success) {
        const convo = data.data.conversation;
        if (convo.messages) {
          setMessages(convo.messages);
        }
        setRound(data.data.followUpRound || 1);
        if (data.data.isComplete) {
          setIsDone(true);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    setIsLoading(true);
    setError(null);
    setShowTimeoutNotice(false);

    // Start timeout timer (90 seconds)
    timeoutRef.current = setTimeout(() => {
      setShowTimeoutNotice(true);
    }, 90000);

    try {
      const response = await fetch('/api/intake/conversation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        router.push(`/projects/${id}/blueprint`);
      } else {
        throw new Error(data.message || 'Blueprint generation failed');
      }
    } catch (error) {
      console.error('Failed to generate blueprint:', error);
      setError('The synthesis engine encountered a validation error. This usually happens when the product architecture is extremely complex.');
      setIsLoading(false);
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  if (isLoading && messages.length === 0) {
    return (
      <AppShell>
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
           <Loader2 className="animate-spin text-[#8b5cf6]" size={40} />
           <p className="text-sm font-bold text-[#475569] uppercase tracking-widest">Initializing Interrogator...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-grow flex flex-col gap-6 max-h-[calc(100vh-140px)]">
        {/* Conversation Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6]">
              <Bot size={24} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold tracking-tight">Product Interroger</h2>
              <span className="text-[10px] text-[#475569] font-bold uppercase tracking-widest">Adversarial Mapping Mode</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-widest">Round {Math.min(round, 3)} of 3</span>
                <div className="w-32 h-1.5 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${(round / 3) * 100}%` }}
                     className="h-full bg-[#8b5cf6] shadow-[0_0_10px_#8b5cf6]" 
                   />
                </div>
             </div>

             {isDone && (
               <Button 
                loading={isLoading}
                onClick={handleGenerateBlueprint} 
                icon={Sparkles} 
                className="animate-glow"
               >
                 Construct Blueprint
               </Button>
             )}
          </div>
        </div>

        {/* Info Banner */}
        {!isDone && (
          <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/10 p-3 rounded-2xl flex items-center gap-4">
             <div className="p-2 bg-[#3b82f6]/10 rounded-lg text-[#3b82f6]">
                <Info size={16} />
             </div>
             <p className="text-xs font-medium text-[#94a3b8]">
               The engine is currently decomposing your product goal. Answer the questions to help it identify high-risk boundaries.
             </p>
          </div>
        )}

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-grow overflow-y-auto pr-4 flex flex-col gap-6 custom-scrollbar scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={clsx(
                  'flex gap-4 max-w-[80%]',
                  msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs mt-1',
                  msg.role === 'user' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-[#8b5cf6]/10 text-[#8b5cf6]'
                )}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={clsx(
                  'p-4 rounded-2xl text-sm leading-relaxed shadow-lg',
                  msg.role === 'user' 
                    ? 'bg-[#3b82f6]/5 text-white border border-[#3b82f6]/10' 
                    : 'glass backdrop-blur-xl text-[#e2e8f0]'
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 self-start"
              >
                 <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-[#8b5cf6]/10 text-[#8b5cf6]">
                    <Sparkles size={16} className="animate-pulse" />
                 </div>
                 <div className="p-4 rounded-2xl glass flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full animate-bounce" />
                 </div>
              </motion.div>
            )}

            {isDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-10"
              >
                 <div className="w-16 h-16 bg-[#10b981]/10 rounded-full flex items-center justify-center text-[#10b981]">
                    <CheckCircle2 size={32} />
                 </div>
                 <div className="text-center">
                    <h3 className="text-xl font-bold">Interrogation Complete</h3>
                    <p className="text-sm text-[#475569] mt-1 font-medium">Product entities and attack surfaces have been identified.</p>
                 </div>
                 <Button 
                  loading={isLoading}
                  onClick={handleGenerateBlueprint} 
                  icon={Sparkles} 
                  className="mt-4"
                 >
                   Construct Final Blueprint
                 </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        {!isDone && (
          <form 
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 bg-white/[0.03] border border-white/5 p-2 rounded-2xl backdrop-blur-xl relative"
          >
            <div className="flex-grow pl-4">
              <input
                type="text"
                placeholder={isSending || !conversationId ? 'Engine processing...' : 'Target product details...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending || isDone || !conversationId}
                className="w-full bg-transparent border-none py-2 text-sm font-medium focus:ring-0 placeholder:text-[#475569]"
              />
            </div>
            <Button 
               type="submit" 
               disabled={!input.trim() || isSending || isDone || !conversationId}
               loading={isSending}
               icon={Send}
               className="!px-4"
            >
              Dispatch
            </Button>
          </form>
        )}
      </div>

       {/* Global Loading Overlay for Blueprint Generation */}
       <AnimatePresence>
         {isLoading && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md"
           >
             <div className="flex flex-col items-center gap-6 p-10 glass-card border-[#8b5cf6]/30">
               <div className="relative">
                 <Loader2 className="animate-spin text-[#8b5cf6]" size={60} />
                 <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#8b5cf6] animate-pulse" size={24} />
               </div>
               <div className="flex flex-col items-center text-center gap-2">
                 <h3 className="text-2xl font-bold tracking-tight">Constructing Blueprint</h3>
                 <p className="text-sm text-[#94a3b8] max-w-[300px]">
                   The AI is decomposing your product into a structural map. This architectural analysis usually takes 30-60 seconds.
                 </p>
                 {showTimeoutNotice && (
                    <motion.p 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     className="text-[10px] text-[#f59e0b] font-bold uppercase tracking-widest mt-4"
                    >
                      Taking longer than expected... Neural mapping is complex.
                    </motion.p>
                 )}
               </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Error Modal */}
       <AnimatePresence>
         {error && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-6"
           >
             <div className="flex flex-col items-center gap-6 p-10 glass-card border-red-500/30 max-w-md w-full">
               <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                 <AlertCircle size={32} />
               </div>
               <div className="text-center">
                 <h3 className="text-xl font-bold">Synthesis Failed</h3>
                 <p className="text-sm text-[#94a3b8] mt-2 leading-relaxed">
                   {error}
                 </p>
               </div>
               <div className="flex flex-col w-full gap-3">
                 <Button onClick={handleGenerateBlueprint} icon={Sparkles} className="w-full">
                   Re-Attempt Synthesis
                 </Button>
                 <Button variant="secondary" onClick={() => setError(null)} className="w-full">
                   Back to Interrogation
                 </Button>
               </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </AppShell>
  );
}

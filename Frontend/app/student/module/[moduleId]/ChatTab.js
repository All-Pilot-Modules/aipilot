'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, Plus, MessageSquare, Loader2, BookOpen, ChevronDown } from "lucide-react";
import { MathText } from "@/components/MathText";
import { apiClient } from "@/lib/auth";
import { chatMessageText, feedbackDiscussionContext } from "@/lib/feedbackDiscussion.mjs";


export default function ChatTab({ moduleId, moduleAccess, feedbackContext, onContextSent }) {
  const [conversations, setConversations] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const selectionKey = `aipilot:chat:${moduleId}:${moduleAccess?.studentId}`;
  const rememberConversation = (id) => {
    try { localStorage.setItem(selectionKey, id || 'new'); } catch {}
  };
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const startedFeedback = useRef(new Set());
  const conversationRevision = useRef(0);
  const feedbackContextRef = useRef(feedbackContext);
  const currentConversationRef = useRef(currentConversationId);
  const [discussionSummary, setDiscussionSummary] = useState(null);
  feedbackContextRef.current = feedbackContext;
  currentConversationRef.current = currentConversationId;
  useEffect(() => {
    if (!feedbackContext?.feedbackId || startedFeedback.current.has(feedbackContext.id)) return;
    startedFeedback.current.add(feedbackContext.id);
    const revision = ++conversationRevision.current;
    setDiscussionSummary({ question: feedbackContext.question, attempt: feedbackContext.attempt, ready: false });
    setCurrentConversationId(null);
    setInputMessage('');
    setMessages([{ role: 'student', content: 'Help me understand this feedback and improve my answer.', created_at: new Date().toISOString() }]);
    setIsSending(true);
    apiClient.post(`/api/chat/feedback/${feedbackContext.feedbackId}/discuss`)
      .then(async response => {
        if (revision !== conversationRevision.current) return;
        const result = response?.data || response;
        const savedResponse = await apiClient.get(`/api/chat/conversations/${result.conversation_id}`);
        if (revision !== conversationRevision.current) return;
        const saved = savedResponse?.data || savedResponse;
        setCurrentConversationId(result.conversation_id);
        rememberConversation(result.conversation_id);
        setMessages(saved.messages || []);
        setConversations(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
        setDiscussionSummary(summary => ({ ...summary, ready: true }));
        onContextSent?.(feedbackContext.id);
      })
      .catch(error => {
        if (revision !== conversationRevision.current) return;
        setMessages([{ role: 'assistant', content: `Could not start the discussion: ${error.message}. Return to Feedback and try again.`, created_at: new Date().toISOString() }]);
        onContextSent?.(feedbackContext.id);
      })
      .finally(() => {
        if (revision === conversationRevision.current) setIsSending(false);
      });
  }, [feedbackContext, onContextSent]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const loadConversation = useCallback(async (conversationId) => {
    const revision = ++conversationRevision.current;
    setLoadingChat(true);
    setHistoryError('');
    try {
      const response = await apiClient.get(`/api/chat/conversations/${conversationId}`);
      if (revision !== conversationRevision.current || feedbackContextRef.current) return;
      const conv = response?.data || response;
      setCurrentConversationId(conversationId);
      try { localStorage.setItem(selectionKey, conversationId); } catch {}
      setMessages(conv.messages || []);
      const context = feedbackDiscussionContext(conv.messages?.[0]);
      setDiscussionSummary(context ? { question: context.question, attempt: context.attempt, ready: true } : null);
    } catch (error) {
      if (revision === conversationRevision.current) setHistoryError('Could not load this chat. Please select it again.');
    } finally {
      if (revision === conversationRevision.current) setLoadingChat(false);
    }
  }, [selectionKey]);

  const loadConversations = useCallback(async () => {
    const revision = conversationRevision.current;
    try {
      setLoadingConversations(true);
      const response = await apiClient.get(
        `/api/chat/conversations?student_id=${moduleAccess.studentId}&module_id=${moduleId}`
      );

      const convs = response?.data || response || [];
      setConversations(convs);

      // If there are conversations, load the most recent one
      if (revision === conversationRevision.current && convs.length > 0 && !currentConversationRef.current && !feedbackContextRef.current) {
        let savedId;
        try { savedId = localStorage.getItem(selectionKey); } catch {}
        if (savedId !== 'new') loadConversation(convs.find(item => item.id === savedId)?.id || convs[0].id);
      }
    } catch (error) {
      setHistoryError('Could not load chat history. Use Refresh history to try again.');
    } finally {
      setLoadingConversations(false);
    }
  }, [moduleAccess?.studentId, moduleId, loadConversation, selectionKey]);

  // Load conversations on mount
  useEffect(() => {
    if (moduleAccess?.studentId) {
      loadConversations();
    }
  }, [moduleAccess, loadConversations]);

  const createNewConversation = async (firstMessage) => {
    try {
      // Create conversation with title from first message
      const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + "..." : firstMessage;

      const response = await apiClient.post('/api/chat/conversations', {
        student_id: moduleAccess.studentId,
        module_id: moduleId,
        title: title
      });

      const newConv = response?.data || response;
      setCurrentConversationId(newConv.id);
      rememberConversation(newConv.id);
      setConversations(prev => [newConv, ...prev]);
      return newConv.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending || loadingChat) return;

    if (feedbackContext) return;
    const revision = ++conversationRevision.current;
    const message = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    // Immediately add student message to UI (optimistic update)
    const tempStudentMsg = {
      role: "student",
      content: message,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempStudentMsg]);

    try {
      let convId = currentConversationId;

      // Create new conversation if this is the first message
      if (!convId) {
        convId = await createNewConversation(message);
        if (!convId) {
          setIsSending(false);
          // Remove the optimistic message if conversation creation fails
          setMessages(prev => prev.slice(0, -1));
          return;
        }
      }

      // Send message and get AI response
      console.log('📤 Sending to AI:', {
        conversationId: convId,
        message: message,
        endpoint: `/api/chat/conversations/${convId}/message`
      });

      const response = await apiClient.post(`/api/chat/conversations/${convId}/message`, {
        message: message
      });

      const result = response?.data || response;
      console.log('📥 AI Response:', result);

      // Ignore a response if a newer feedback discussion replaced this chat.
      if (revision !== conversationRevision.current) return;
      setMessages(prev => [...prev, result.assistant_message]);

    } catch (error) {
      console.error('Failed to send message:', error);
      if (revision !== conversationRevision.current) return;
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      if (revision === conversationRevision.current) setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewChat = () => {
    ++conversationRevision.current;
    setCurrentConversationId(null);
    currentConversationRef.current = null;
    setMessages([]);
    setDiscussionSummary(null);
    setInputMessage('');
    setHistoryError('');
    rememberConversation(null);
    inputRef.current?.focus();
  };
  const busy = isSending || loadingChat || !!feedbackContext;
  const initialLoading = loadingConversations && !isSending && !feedbackContext && messages.length === 0;

  return (
    <section aria-label="AI tutor chat" className="flex h-[min(760px,80dvh)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">AI tutor</h2>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0">
            <label htmlFor="chat-history" className="sr-only">Chat history</label>
            <select id="chat-history" value={currentConversationId || ''} disabled={busy || initialLoading}
              onChange={event => { if (event.target.value) loadConversation(event.target.value); }}
              className="h-9 w-36 appearance-none truncate rounded-lg bg-muted/50 py-2 pl-3 pr-8 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-60">
              <option value="" disabled>{initialLoading ? 'Loading history…' : 'Chat history'}</option>
              {conversations.map(conversation => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <Button variant="ghost" size="sm" disabled={busy} onClick={startNewChat} className="h-9 rounded-lg px-2.5" aria-label="New chat">
            <Plus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">New chat</span>
          </Button>
        </div>
      </header>

      {historyError && <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs text-destructive sm:px-6" role="alert">
        <span>{historyError}</span><button className="rounded px-1 py-1 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring" onClick={loadConversations}>Refresh history</button>
      </div>}

      {discussionSummary && <details className="group border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Feedback discussion · Attempt {discussionSummary.attempt}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3 max-w-3xl text-sm leading-relaxed">
          <MathText>{discussionSummary.question}</MathText>
          <p className="mt-2 text-xs text-muted-foreground">{isSending ? 'Reviewing your answer and feedback…' : discussionSummary.ready ? 'Your question, answer, score, and feedback are included.' : 'Return to Feedback to try starting this discussion again.'}</p>
        </div>
      </details>}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8" aria-busy={initialLoading || loadingChat}>
        {initialLoading || loadingChat ? (
          <div className="mx-auto max-w-3xl space-y-5 py-10" role="status" aria-label="Loading conversation">
            <Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" />
            <div className="space-y-3"><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
          </div>
        ) : messages.length === 0 && !isSending ? (
          <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center py-12 text-center">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60"><BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">What would you like to understand?</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Explore your course materials or work through a question together.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {['Explain a concept', 'Help me practice', 'Walk through an example'].map(prompt => (
                <button key={prompt} onClick={() => { setInputMessage(prompt); inputRef.current?.focus(); }} className="rounded-full border border-border/80 px-4 py-2.5 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{prompt}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8 py-8" role="log" aria-label="Conversation">
            {messages.map((msg, index) => (
              <article key={msg.id || index} aria-label={msg.role === 'student' ? 'Your message' : 'AI tutor response'} className={msg.role === 'student' ? 'flex justify-end' : ''}>
                <div className={msg.role === 'student' ? 'min-w-0 max-w-[90%] rounded-3xl bg-muted px-5 py-3 sm:max-w-[80%]' : 'min-w-0 py-1'}>
                  <MathText className="break-words text-[15px] leading-7 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">{chatMessageText(msg)}</MathText>
                </div>
              </article>
            ))}
          </div>
        )}
        {isSending && <div className="mx-auto flex max-w-3xl items-center gap-2 pb-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{feedbackContext ? 'Reviewing your feedback…' : 'Thinking…'}</span>
        </div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-border bg-muted/30 p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/20">
            <textarea ref={inputRef} rows={2} aria-label="Message to AI tutor" placeholder="Ask your tutor…"
              value={inputMessage} onChange={event => setInputMessage(event.target.value)} onKeyDown={handleKeyPress}
              disabled={isSending || loadingChat || initialLoading}
              className="block max-h-40 min-h-16 w-full resize-y border-0 bg-transparent px-3 py-2 text-base leading-6 placeholder:text-muted-foreground focus:outline-none disabled:opacity-60 sm:text-sm" />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[11px] text-muted-foreground">Course materials & feedback</span>
              <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || busy || initialLoading} aria-label={isSending ? 'Waiting for response' : 'Send message'} className="h-9 w-9 rounded-full bg-teal-700 p-0 text-white hover:bg-teal-800">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
          </div>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">AI can make mistakes. Check important details with your course materials.</p>
        </div>
      </div>
    </section>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Bot, Check, ChevronDown, CircleHelp,
  Clock3, Code2, Command, ExternalLink, FileText, Globe2, History,
  KeyRound, LogOut, Menu, MessageCircle, MessageSquarePlus, Moon,
  PanelLeftClose, PanelLeftOpen, Plus, Send, Settings, ShieldCheck,
  Sparkles, Sun, Trash2, User, X, Zap
} from "lucide-react";
import { isConfigured, supabase } from "./supabase";

const starterPrompts = [
  { icon: Code2, title: "Write code", prompt: "Help me write a clean, well-explained piece of code." },
  { icon: FileText, title: "Explain a topic", prompt: "Explain a difficult topic step by step, with examples." },
  { icon: Globe2, title: "Build a website", prompt: "Help me plan and build a responsive website." },
  { icon: Sparkles, title: "Explore an idea", prompt: "Help me develop a practical idea into a clear plan." }
];

function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dark, setDark] = useState(true);
  const [profile, setProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [configNotice, setConfigNotice] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
      loadConversations();
    } else {
      setProfile(null); setConversations([]); setMessages([]); setActiveId(null);
    }
  }, [session?.user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => {
    if (session && activeId) loadMessages(activeId);
  }, [session?.user?.id, activeId]);

  async function loadProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(data || { display_name: session.user.user_metadata?.full_name || session.user.email });
  }

  async function loadConversations() {
    const { data, error } = await supabase.from("conversations")
      .select("id,title,created_at,updated_at").order("updated_at", { ascending: false });
    if (!error) {
      setConversations(data || []);
      if (!activeId && data?.length) setActiveId(data[0].id);
    }
  }

  async function loadMessages(id) {
    const { data, error } = await supabase.from("messages")
      .select("id,role,content,created_at").eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (!error) setMessages(data || []);
  }

  async function handleAuth(event) {
    event.preventDefault(); setAuthError(""); setAuthNotice(""); setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email.trim(), password: authForm.password,
          options: { data: { full_name: authForm.name.trim() } }
        });
        if (error) throw error;
        if (!data.session) setAuthNotice("Account created. Check your email to confirm your address, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email.trim(), password: authForm.password
        });
        if (error) throw error;
      }
    } catch (error) { setAuthError(error.message || "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function googleSignIn() {
    setAuthError(""); setAuthNotice("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) setAuthError(error.message);
  }

  async function signOut() { await supabase.auth.signOut(); setShowProfile(false); }

  async function newConversation() {
    if (!session) return;
    const { data, error } = await supabase.from("conversations").insert({
      user_id: session.user.id, title: "New conversation"
    }).select().single();
    if (error) { alert(error.message); return; }
    setConversations(prev => [data, ...prev]); setActiveId(data.id); setMessages([]);
    setInput(""); inputRef.current?.focus();
  }

  async function deleteConversation(id, event) {
    event?.stopPropagation();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id || null);
      setMessages([]);
    }
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || busy || !session) return;
    let conversationId = activeId;
    if (!conversationId) {
      const { data, error } = await supabase.from("conversations").insert({
        user_id: session.user.id, title: text.slice(0, 48) || "New conversation"
      }).select().single();
      if (error) { alert(error.message); return; }
      conversationId = data.id; setActiveId(data.id); setConversations(prev => [data, ...prev]);
    }
    setInput(""); setBusy(true);
    const optimistic = { id: crypto.randomUUID(), role: "user", content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const { data: userMessage, error: saveUserError } = await supabase.from("messages").insert({
        conversation_id: conversationId, user_id: session.user.id, role: "user", content: text
      }).select().single();
      if (saveUserError) throw saveUserError;

      const token = session.access_token;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversationId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The AI request failed.");
      const answer = payload.reply || "I couldn't generate a response. Please try again.";
      const { data: savedAssistant, error: saveAssistantError } = await supabase.from("messages").insert({
        conversation_id: conversationId, user_id: session.user.id, role: "assistant", content: answer
      }).select().single();
      if (saveAssistantError) throw saveAssistantError;
      setMessages(prev => [...prev.filter(m => m.id !== optimistic.id), userMessage, savedAssistant]);
      await supabase.from("conversations").update({
        title: text.slice(0, 48), updated_at: new Date().toISOString()
      }).eq("id", conversationId);
      loadConversations();
    } catch (error) {
      setMessages(prev => [...prev.filter(m => m.id !== optimistic.id), optimistic,
        { id: crypto.randomUUID(), role: "assistant", content: `I couldn't complete that request: ${error.message}`, failed: true }]);
    } finally { setBusy(false); inputRef.current?.focus(); }
  }

  const activeTitle = conversations.find(c => c.id === activeId)?.title || "New conversation";
  const userInitial = (profile?.display_name || session?.user?.email || "N").slice(0, 1).toUpperCase();

  if (!isConfigured) return <SetupScreen />;
  if (!session) return (
    <div className={`auth-page ${dark ? "dark" : "light"}`}>
      <div className="auth-glow glow-one"></div><div className="auth-glow glow-two"></div>
      <header className="auth-top"><Brand /><button className="theme-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></header>
      <main className="auth-layout">
        <section className="auth-copy">
          <div className="eyebrow"><span className="pulse-dot"></span> YOUR INTELLIGENT WORKSPACE</div>
          <h1>Ideas become<br/><span>possibilities.</span></h1>
          <p>Meet NOVA AI — a focused assistant for learning, building, creating and solving problems.</p>
          <div className="auth-benefits">
            <div><ShieldCheck size={17}/> Your own private account</div>
            <div><History size={17}/> Conversations saved to your account</div>
            <div><Zap size={17}/> AI-powered assistance</div>
          </div>
          <div className="auth-credit">A product by <strong>NOVA™ Tech Company</strong></div>
        </section>
        <section className="auth-card">
          <div className="auth-card-head">
            <div className="mini-mark"><Sparkles size={20}/></div>
            <div><h2>{authMode === "signup" ? "Create your account" : "Welcome back"}</h2><p>{authMode === "signup" ? "Start your NOVA experience." : "Sign in to continue to NOVA AI."}</p></div>
          </div>
          <button className="google-button" onClick={googleSignIn}><GoogleMark/> Continue with Google</button>
          <div className="or-divider"><span></span> OR CONTINUE WITH EMAIL <span></span></div>
          <form onSubmit={handleAuth} className="auth-form">
            {authMode === "signup" && <label>Full name<input required autoComplete="name" value={authForm.name} onChange={e => setAuthForm({...authForm,name:e.target.value})} placeholder="Your name"/></label>}
            <label>Email address<input required type="email" autoComplete="email" value={authForm.email} onChange={e => setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></label>
            <label>Password<input required minLength={6} type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authForm.password} onChange={e => setAuthForm({...authForm,password:e.target.value})} placeholder="At least 6 characters"/></label>
            {authError && <div className="form-error">{authError}</div>}
            {authNotice && <div className="form-notice">{authNotice}</div>}
            <button className="primary-button full" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"} <ArrowUp size={16}/></button>
          </form>
          <p className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to NOVA AI?"} <button onClick={() => {setAuthMode(authMode === "signup" ? "signin" : "signup");setAuthError("");setAuthNotice("");}}>{authMode === "signup" ? "Sign in" : "Create an account"}</button></p>
          <p className="legal-note">By continuing, you agree to use NOVA AI responsibly. Keep your password private.</p>
        </section>
      </main>
    </div>
  );

  return (
    <div className={`app-shell ${dark ? "dark" : "light"}`}>
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"} ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><Brand/><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
        <button className="new-chat-button" onClick={newConversation}><Plus size={17}/> New chat <span>⌘ K</span></button>
        <div className="side-label">WORKSPACE</div>
        <button className="side-link active"><MessageCircle size={17}/> AI Assistant</button>
        <button className="side-link" onClick={() => setConfigNotice("More NOVA tools will be added in a future release.")}><Activity size={17}/> Explore tools <span className="soon-tag">SOON</span></button>
        <div className="history-heading"><span>RECENT CHATS</span><History size={15}/></div>
        <div className="conversation-list">
          {conversations.map(c => <div key={c.id} className={`conversation-row ${activeId === c.id ? "selected" : ""}`} onClick={() => {setActiveId(c.id);setMobileMenu(false);}}>
            <MessageCircle size={15}/><span>{c.title}</span><button title="Delete conversation" onClick={e => deleteConversation(c.id,e)}><Trash2 size={14}/></button>
          </div>)}
          {!conversations.length && <p className="empty-history">Your conversations will appear here.</p>}
        </div>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-icon"><Sparkles size={16}/></div><div><strong>NOVA AI</strong><span>Your ideas, accelerated.</span></div></div>
          <button className="profile-button" onClick={() => setShowProfile(!showProfile)}>
            <span className="avatar">{userInitial}</span><span className="profile-text"><strong>{profile?.display_name || session.user.email}</strong><small>{session.user.email}</small></span><ChevronDown size={15}/>
          </button>
          {showProfile && <div className="profile-menu"><div className="profile-email">{session.user.email}</div><button onClick={signOut}><LogOut size={15}/> Sign out</button></div>}
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={19}/></button><button className="icon-button desktop-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</button><span className="breadcrumb">Workspace <span>/</span> <strong>{activeTitle}</strong></span></div>
          <div className="topbar-right"><span className="secure-label"><span className="pulse-dot"></span> AI ONLINE</span><button className="icon-button" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="avatar top-avatar" onClick={() => setShowProfile(!showProfile)}>{userInitial}</button></div>
        </header>
        {configNotice && <div className="notice-bar">{configNotice}<button onClick={() => setConfigNotice("")}><X size={14}/></button></div>}
        <section className={`chat-area ${messages.length ? "has-messages" : ""}`}>
          {!messages.length ? <div className="welcome-panel">
            <div className="welcome-orb"><div className="orb-inner"><Sparkles size={27}/></div><span className="orb-ring ring-a"></span><span className="orb-ring ring-b"></span></div>
            <div className="welcome-kicker">WELCOME TO YOUR WORKSPACE</div>
            <h1>What can I help you<br/><span>create today?</span></h1>
            <p>Ask a question, explore an idea or get help turning your next big plan into reality.</p>
            <div className="prompt-grid">{starterPrompts.map(item => <button key={item.title} className="prompt-card" onClick={() => sendMessage(item.prompt)}><item.icon size={18}/><span><strong>{item.title}</strong><small>{item.prompt}</small></span><ArrowUp size={15}/></button>)}</div>
          </div> : <div className="message-list">
            {messages.map(m => <article key={m.id} className={`message ${m.role} ${m.failed ? "failed" : ""}`}>
              <div className="message-avatar">{m.role === "assistant" ? <Sparkles size={17}/> : userInitial}</div>
              <div className="message-content"><div className="message-author">{m.role === "assistant" ? "NOVA AI" : "YOU"} <span>{m.role === "assistant" ? "· AI ASSISTANT" : "· MESSAGE"}</span></div><div className="message-text">{m.content}</div></div>
            </article>)}
            {busy && <article className="message assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="message-content"><div className="message-author">NOVA AI <span>· THINKING</span></div><div className="typing"><i></i><i></i><i></i></div></div></article>}
            <div ref={bottomRef}/>
          </div>}
        </section>
        <footer className="composer-wrap">
          <div className="composer">
            <textarea ref={inputRef} rows="1" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Message NOVA AI…"/>
            <div className="composer-tools"><span><Command size={13}/> Enter to send · Shift + Enter for new line</span><button className="send-button" disabled={!input.trim() || busy} onClick={() => sendMessage()}><ArrowUp size={18}/></button></div>
          </div>
          <p className="disclaimer">NOVA AI can make mistakes. Verify important information before relying on it.</p>
        </footer>
      </main>
      {mobileMenu && <div className="mobile-backdrop" onClick={() => setMobileMenu(false)}></div>}
    </div>
  );
}

function Brand() { return <div className="brand"><div className="brand-symbol"><span></span><span></span><span></span></div><div><strong>NOVA<span>AI</span></strong><small>BY NOVA TECH COMPANY</small></div></div>; }
function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/><path fill="#4A90E2" d="M12.6 27.7a12 12 0 0 1 0-7.5v-5.3H5.8a20 20 0 0 0 0 18.1l6.8-5.3z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.6 29.5 4 24 4A20 20 0 0 0 5.8 14.9l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4z"/></svg>; }

function SetupScreen() {
  return <div className="setup-page"><div className="setup-card"><Brand/><div className="setup-icon"><KeyRound size={25}/></div><h1>One quick setup step</h1><p>NOVA AI's website is ready, but it needs your Supabase project details before accounts and chat can work.</p><ol><li>Create a free project at <a href="https://supabase.com/" target="_blank" rel="noreferrer">Supabase</a>.</li><li>Copy the Project URL and anon/publishable key.</li><li>Copy <code>.env.example</code> to <code>.env</code> and add those values.</li><li>Run the database setup in <code>supabase/schema.sql</code>.</li></ol><div className="setup-note"><CircleHelp size={17}/><span>Open <strong>README.md</strong> in the project folder for the full Google sign-in, Gemini API and deployment instructions.</span></div><div className="setup-footer">NOVA™ Tech Company · Full-stack starter</div></div></div>;
}

export default App;

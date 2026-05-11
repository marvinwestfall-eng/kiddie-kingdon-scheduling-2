import React, { useState, useEffect } from 'react';
import { LogIn, Calendar, Users, ChevronRight, CheckCircle2, AlertCircle, Settings, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { format, nextSunday, addDays } from 'date-fns';

type User = {
  name: string;
  phone: string;
  email: string;
  birthday?: string;
  isAdmin: boolean;
};

type ScheduleSlot = {
  date: string;
  time: string;
  role: string;
  volunteerName: string;
};

function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LOGIN' | 'HOME' | 'SIGNUP' | 'DIRECTORY' | 'ROSTER'>('LOGIN');

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setConfigured(data.configured);
        setIsMockMode(data.mockMode);
        setConnectionError(data.connectionError);
      })
      .catch(() => setConfigured(false));
      
    const stored = localStorage.getItem('kk_user');
    if (stored) {
      setUser(JSON.parse(stored));
      setView('HOME');
    }
  }, []);

  if (configured === false) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 brutal-border text-[#1A1A1A]">
          <div className="flex justify-center mb-6">
            <Settings size={64} className="text-[#1A1A1A]" />
          </div>
          <h1 className="text-4xl font-black uppercase text-center mb-4 leading-none">Setup Required</h1>
          <p className="font-bold mb-6 text-center text-lg">
            Kiddie Kingdom needs to be connected to Google Sheets. 
          </p>
          <div className="bg-yellow-300 p-4 border-4 border-[#1A1A1A] font-bold text-sm mb-4">
            {connectionError ? (
               <span className="text-red-700">{connectionError}</span>
            ) : (
              <span>Please check the <code className="bg-white px-2 py-1 border-2 border-[#1A1A1A] uppercase">.env.example</code> file and provide your Service Account details in the Environment Variables to continue.</span>
            )}
          </div>
          {connectionError && <div className="text-sm font-bold text-gray-600 bg-gray-100 p-4 border-2 border-[#1A1A1A] italic">Ensure your Service Account Email is added directly as an "Editor" to the Google Sheet by clicking "Share" in the top right corner of your spreadsheet.</div>}
        </div>
      </div>
    );
  }

  if (view === 'LOGIN' || !user) {
    return <LoginView onLogin={(u) => {
      setUser(u);
      localStorage.setItem('kk_user', JSON.stringify(u));
      setView('HOME');
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3] font-sans pb-32 flex flex-col">
      {isMockMode && (
        <div className="bg-yellow-300 border-b-4 border-[#1A1A1A] p-2 text-center font-black uppercase text-sm">
          ⚠️ Running in Demo Mode (No Google Sheet Connected)
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b-4 border-[#1A1A1A] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">Kiddie<br/>Kingdom</h1>
          <div className="w-10 h-10 bg-yellow-300 border-4 border-[#1A1A1A] flex items-center justify-center font-black text-xl uppercase">
            {user.name.charAt(0)}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-8 mt-4 flex-grow">
        {view === 'HOME' && <HomeView onSign={() => setView('SIGNUP')} user={user} onLogout={() => {
          localStorage.removeItem('kk_user');
          setUser(null);
          setView('LOGIN');
        }} />}
        {view === 'SIGNUP' && <SignUpFlow user={user} onComplete={() => setView('HOME')} onCancel={() => setView('HOME')} />}
        {view === 'DIRECTORY' && <DirectoryView />}
        {view === 'ROSTER' && <RosterView />}
      </main>

      {/* Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#FDF8F3] border-t-4 border-[#1A1A1A] pb-safe z-20">
        <div className="max-w-4xl mx-auto flex gap-4 p-2">
          <button 
            onClick={() => setView('HOME')}
            className={`flex-1 flex justify-center items-center py-2 brutal-border-sm text-lg font-black uppercase transition-colors ${view === 'HOME' || view === 'SIGNUP' ? 'tab-active' : 'bg-white hover:bg-yellow-200'}`}
          >
            ME
          </button>
          <button 
            onClick={() => setView('ROSTER')}
            className={`flex-1 flex justify-center items-center py-2 brutal-border-sm text-lg font-black uppercase transition-colors ${view === 'ROSTER' ? 'tab-active' : 'bg-white hover:bg-yellow-200'}`}
          >
            ROSTER
          </button>
          <button 
            onClick={() => setView('DIRECTORY')}
            className={`flex-1 flex justify-center items-center py-2 brutal-border-sm text-lg font-black uppercase transition-colors ${view === 'DIRECTORY' ? 'tab-active' : 'bg-white hover:bg-yellow-200'}`}
          >
            TEAM
          </button>
        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// Login View
// -------------------------------------------------------------
function LoginView({ onLogin }: { onLogin: (user: User) => void }) {
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName || !loginPhone) {
      setError('Please provide both your name and phone number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginName, loginPhone })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || 'User not found. Check with leadership.');
      }
    } catch (err) {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 brutal-border text-[#1A1A1A]">
        <div className="w-24 h-24 bg-yellow-300 border-4 border-[#1A1A1A] flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_#1A1A1A]">
          <Calendar size={48} className="text-[#1A1A1A]" />
        </div>
        <h1 className="text-5xl font-black uppercase text-center mb-2 leading-none">Welcome<br/>Back</h1>
        <p className="text-center font-bold mb-8 mt-4 text-xl">Sign in to book your serving slot.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xl font-black uppercase mb-2">Name (as on sheet)</label>
            <input 
              type="text" 
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              className="w-full text-xl p-5 bg-white border-4 border-[#1A1A1A] font-bold focus:bg-yellow-200 transition-colors outline-none brutal-border-sm placeholder:italic placeholder:font-bold placeholder:opacity-50"
              placeholder="e.g. Sarah Miller"
            />
          </div>
          <div>
            <label className="block text-xl font-black uppercase mb-2">Cell Number</label>
            <input 
              type="tel" 
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              className="w-full text-xl p-5 bg-white border-4 border-[#1A1A1A] font-bold focus:bg-yellow-200 transition-colors outline-none brutal-border-sm placeholder:italic placeholder:font-bold placeholder:opacity-50"
              placeholder="e.g. 082 555 0192"
            />
          </div>
          {error && <div className="text-white text-center font-bold bg-red-500 p-4 border-4 border-[#1A1A1A] flex items-center gap-2 uppercase text-lg">
            <AlertCircle size={24} />
            {error}
          </div>}
          <button type="submit" className="w-full bg-black text-white text-3xl font-black py-5 brutal-border hover:bg-yellow-300 hover:text-black transition-all active:translate-x-1 active:translate-y-1 active:shadow-none uppercase mt-2" disabled={loading}>
            {loading ? 'WAIT...' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Home View
// -------------------------------------------------------------
function HomeView({ onSign, user, onLogout }: { onSign: () => void, user: User, onLogout: () => void }) {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState<number | null>(null);

  const fetchData = () => {
    Promise.all([
      fetch('/api/schedule').then(r => r.json()),
      fetch('/api/directory').then(r => r.json())
    ]).then(([schedData, dirData]) => {
      setSchedule(Array.isArray(schedData) ? schedData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancel = async (booking: ScheduleSlot, index: number) => {
    setCanceling(index);
    try {
      const resp = await fetch('/api/book', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });
      if (resp.ok) {
        fetchData();
      } else {
        const errorData = await resp.json().catch(() => ({}));
        console.error(`Failed to cancel slot: ${errorData.error || resp.statusText}`);
      }
    } catch (e) {
      console.error('Error connecting to server on cancel.');
    }
    setCanceling(null);
  };

  const myBookings = schedule.filter(s => s.volunteerName === user.name || s.volunteerName === `${user.name} (Tentative)`);

  // Filter birthdays for the current month
  const currentMonthName = format(new Date(), 'MMMM').toLowerCase();
  const currentMonthShort = format(new Date(), 'MMM').toLowerCase();
  const currentMonthNumPad = format(new Date(), 'MM');
  const currentMonthNum = format(new Date(), 'M');

  const upcomingBirthdays = directory.filter(u => {
    if (!u.birthday || u.birthday.trim() === '') return false;
    const bStr = u.birthday.toLowerCase();
    return bStr.includes(currentMonthName) || 
           bStr.includes(currentMonthShort) ||
           bStr.startsWith(`${currentMonthNumPad}/`) ||
           bStr.startsWith(`${currentMonthNum}/`) ||
           bStr.includes(`-${currentMonthNumPad}-`);
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white p-8 brutal-border text-center">
        <h2 className="text-4xl sm:text-5xl font-black uppercase mb-4 leading-none">Ready<br/>To Serve?</h2>
        <p className="font-bold text-lg sm:text-xl mb-8 border-b-4 border-[#1A1A1A] inline-block pb-2">Sign up for an upcoming Sunday shift.</p>
        <button onClick={onSign} className="w-full bg-black text-white text-2xl sm:text-3xl lg:text-4xl font-black py-6 brutal-border hover:bg-yellow-300 hover:text-black transition-all active:translate-x-1 active:translate-y-1 active:shadow-none uppercase">
          Sign Up For Sunday
        </button>
      </div>

      <div>
        <h3 className="text-3xl font-black uppercase mb-6 border-b-4 border-[#1A1A1A] inline-block">My Shifts</h3>
        {loading ? (
          <div className="text-center font-bold text-xl uppercase italic">Loading schedule...</div>
        ) : myBookings.length === 0 ? (
          <div className="bg-white p-6 brutal-border text-center font-bold text-xl uppercase">
            No upcoming shifts yet.
          </div>
        ) : (
          <div className="space-y-6">
            {myBookings.map((b, i) => (
              <div key={i} className="bg-white p-6 brutal-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-black text-3xl sm:text-4xl uppercase bg-yellow-300 inline-block px-3 py-1 brutal-border-sm mb-4">{b.date}</div>
                  <div className="font-bold text-xl uppercase role-row pb-2 flex items-center gap-4">
                    <span>{b.time}</span>
                    <span className="opacity-50">&bull;</span>
                    <span>{b.role}</span>
                    {b.volunteerName.includes('(Tentative)') && (
                      <span className="ml-2 bg-orange-300 italic text-white line-through decoration-black decoration-2 px-2 py-1 text-sm border-2 border-[#1A1A1A] flex flex-col leading-none items-center shadow-[2px_2px_0px_0px_#1A1A1A]">
                        <span className="not-italic no-underline text-black text-xs font-black">TENTATIVE</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(b, i)}
                  disabled={canceling === i}
                  className="flex items-center gap-2 px-4 py-3 bg-red-400 text-black border-4 border-[#1A1A1A] font-black uppercase text-lg hover:bg-black hover:text-white transition-colors active:translate-x-1 active:translate-y-1 w-full sm:w-auto justify-center"
                >
                  <Trash2 size={24} />
                  {canceling === i ? 'CANCELLING...' : 'CANCEL'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {upcomingBirthdays.length > 0 && (
        <div>
          <h3 className="text-3xl font-black uppercase mb-6 border-b-4 border-[#1A1A1A] inline-block">Birthdays</h3>
          <div className="bg-yellow-300 p-6 brutal-border">
            <h4 className="font-black text-2xl uppercase mb-4">Let's Celebrate {format(new Date(), 'MMMM')}! 🥳</h4>
            <div className="space-y-4">
              {upcomingBirthdays.map((bdayUser, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-4 border-4 border-[#1A1A1A]">
                  <div className="font-black text-xl uppercase">{bdayUser.name}</div>
                  <div className="font-bold text-lg bg-yellow-300 px-3 py-1 border-2 border-[#1A1A1A] uppercase">
                    {bdayUser.birthday}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="text-center pt-8">
         <button onClick={onLogout} className="font-black text-xl uppercase underline hover:bg-yellow-300 px-4 py-2 brutal-border-sm bg-white transition-colors">Sign Out</button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Sign Up Flow
// -------------------------------------------------------------
const ROLES = ['Teacher', 'Registration', 'Snacks', 'Arts and Craft', 'Playground Duty'];

function SignUpFlow({ user, onComplete, onCancel }: { user: User, onComplete: () => void, onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [isTentative, setIsTentative] = useState<boolean>(false);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/schedule').then(r => r.json()).then(data => setSchedule(Array.isArray(data) ? data : []));
  }, []);

  // Generate Sundays for a full quarter (approx 13 Sundays)
  const upcomingSundays: string[] = [];
  let currentSunday = nextSunday(new Date());
  for (let i = 0; i < 13; i++) {
    upcomingSundays.push(format(currentSunday, 'MMMM do, yyyy'));
    currentSunday = addDays(currentSunday, 7);
  }

  const handleConfirm = async () => {
    setLoading(true);
    const finalName = isTentative ? `${user.name} (Tentative)` : user.name;
    await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time, role, volunteerName: finalName })
    });
    setLoading(false);
    onComplete();
  };

  // Check capacities
  const getCapacity = (d: string, t: string) => schedule.filter(s => s.date === d && s.time === t).length;
  const hasTeacher = (d: string, t: string) => schedule.some(s => s.date === d && s.time === t && s.role === 'Teacher');

  return (
    <div className="bg-[#FDF8F3] relative animate-in fade-in zoom-in-95 duration-300">
      
      {step === 1 && (
        <div className="space-y-6 mt-4">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-4xl font-black uppercase italic leading-none">Pick<br/>Sunday</h2>
              <button onClick={onCancel} className="bg-red-400 text-black border-4 border-[#1A1A1A] hover:bg-red-500 font-bold px-4 py-2 text-xl shadow-[4px_4px_0px_0px_#1A1A1A] uppercase active:translate-x-1 active:translate-y-1 active:shadow-none">Cancel</button>
          </div>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 pb-4">
            {upcomingSundays.map(d => (
              <button 
                key={d} 
                onClick={() => { setDate(d); setStep(2); }}
                className="w-full p-4 text-left hover:bg-yellow-300 transition-colors flex items-center justify-between bg-white brutal-border active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <span className="text-xl font-black uppercase sm:text-2xl">{d}</span>
                <ChevronRight size={28} className="text-[#1A1A1A]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 mt-4">
          <div className="flex justify-between items-center mb-2">
              <h2 className="text-4xl font-black uppercase italic leading-none">Pick<br/>Time</h2>
              <button onClick={() => setStep(1)} className="bg-white text-black border-4 border-[#1A1A1A] hover:bg-yellow-300 font-bold px-3 py-1 shadow-[4px_4px_0px_0px_#1A1A1A] uppercase text-lg">&larr; Back</button>
          </div>
          <p className="text-2xl font-black bg-yellow-300 inline-block px-3 py-1 brutal-border-sm mb-6 uppercase">{date}</p>
          
          <div className="space-y-6">
            {['8:30 AM', '10:30 AM'].map(t => {
              const count = getCapacity(date, t);
              const isFull = count >= 5;
              
              return (
                <button 
                  key={t}
                  disabled={isFull}
                  onClick={() => { setTime(t); setStep(3); }}
                  className={`w-full p-6 text-left transition-all flex items-center justify-between brutal-border active:translate-x-1 active:translate-y-1 active:shadow-none
                    ${isFull ? 'bg-gray-200 opacity-60 cursor-not-allowed border-4 border-[#1A1A1A]' : 'bg-white hover:bg-yellow-300 border-4 border-[#1A1A1A]'}`}
                >
                  <div className="flex items-center gap-4 w-full justify-between">
                    <div className="text-2xl sm:text-3xl font-black uppercase italic">{t}</div>
                    {isFull ? <span className="status-tag bg-red-500 text-white leading-none px-3 py-2 text-lg">FULL</span> : <span className="status-tag bg-green-400 leading-none px-3 py-2 text-lg">{5 - count} SPOTS</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 mt-4">
          <div className="flex justify-between items-center mb-2">
             <h2 className="text-4xl font-black uppercase italic leading-none">Pick<br/>Role</h2>
             <button onClick={() => setStep(2)} className="bg-white text-black border-4 border-[#1A1A1A] hover:bg-yellow-300 font-bold px-3 py-1 shadow-[4px_4px_0px_0px_#1A1A1A] uppercase text-lg">&larr; Back</button>
          </div>
          <p className="text-2xl font-black bg-yellow-300 inline-block px-3 py-1 brutal-border-sm mb-6 uppercase">{date} &bull; {time}</p>
          
          <div className="space-y-4">
            {ROLES.map(r => {
              const disabled = r === 'Teacher' && hasTeacher(date, time);
              return (
                <button 
                  key={r}
                  disabled={disabled}
                  onClick={() => setRole(r)}
                  className={`w-full p-5 text-left transition-all flex items-center justify-between
                    ${role === r ? 'bg-black text-white brutal-border translate-x-1 translate-y-1 shadow-none' : disabled ? 'bg-gray-200 opacity-50 brutal-border' : 'bg-white brutal-border hover:bg-yellow-300 active:translate-x-1 active:translate-y-1 active:shadow-none'}
                  `}
                >
                  <span className="text-2xl font-black uppercase">{r}</span>
                  {disabled && <span className="status-tag bg-red-500 text-white leading-none px-3 py-2 text-lg">TAKEN</span>}
                </button>
              );
            })}
          </div>

          {role && (
            <div className="pt-6 mt-8 animate-in slide-in-from-bottom-4 space-y-4">
              <button type="button" onClick={() => setIsTentative(!isTentative)} className="w-full flex items-center gap-4 bg-white p-4 brutal-border cursor-pointer hover:bg-yellow-100 transition-colors select-none">
                <div className={`w-8 h-8 flex flex-shrink-0 items-center justify-center border-4 border-[#1A1A1A] ${isTentative ? 'bg-black text-white' : 'bg-white'}`}>
                  {isTentative && <CheckCircle2 size={24} />}
                </div>
                <span className="font-black text-xl uppercase leading-tight">Mark as Tentative</span>
              </button>

              <button onClick={handleConfirm} className="w-full bg-yellow-300 text-black text-3xl font-black py-6 brutal-border hover:bg-black hover:text-white transition-all active:translate-x-1 active:translate-y-1 active:shadow-none uppercase" disabled={loading}>
                {loading ? 'WAIT...' : 'CONFIRM'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Directory View
// -------------------------------------------------------------
function DirectoryView() {
  const [directory, setDirectory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/directory')
      .then(r => r.json())
      .then(data => {
        setDirectory(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-start mb-6">
          <h2 className="text-3xl font-black uppercase border-b-4 border-[#1A1A1A] inline-block">Directory</h2>
      </div>
      {loading ? (
        <div className="text-center font-bold text-xl uppercase italic">Loading directory...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {directory.map((member, i) => {
            const colors = ['bg-blue-400', 'bg-pink-400', 'bg-purple-400', 'bg-green-400', 'bg-orange-400', 'bg-yellow-400'];
            const bgClass = colors[i % colors.length];
            return (
              <div key={i} className="bg-white p-6 brutal-border flex flex-col justify-between h-full">
                <div className="flex items-center gap-4 mb-6 border-b-4 border-[#1A1A1A] pb-6">
                  <div className={`w-16 h-16 ${bgClass} rounded-full border-4 border-[#1A1A1A] flex items-center justify-center text-3xl font-black uppercase shadow-[4px_4px_0px_0px_#1A1A1A]`}>
                    {member.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-2xl font-black uppercase leading-none">{member.name}</div>
                    {member.birthday && <div className="text-sm font-bold mt-3 font-mono bg-yellow-300 inline-block px-2 py-1 border-2 border-[#1A1A1A] uppercase">🎉 {member.birthday}</div>}
                  </div>
                </div>
                <div className="space-y-4 font-bold text-lg">
                  {member.phone && (
                    <div className="role-row pb-2 flex justify-between items-center">
                      <span className="uppercase opacity-60">Phone</span>
                      <a href={`tel:${member.phone}`} className="hover:bg-yellow-300 px-2 uppercase">{member.phone}</a>
                    </div>
                  )}
                  {member.email && (
                    <div className="role-row pb-2 flex justify-between items-center">
                      <span className="uppercase opacity-60">Email</span>
                      <a href={`mailto:${member.email}`} className="hover:bg-yellow-300 px-2 max-w-[200px] truncate uppercase">{member.email}</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Roster View
// -------------------------------------------------------------
function RosterView() {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const [remindStatus, setRemindStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/schedule').then(r => r.json()).then(data => {
      setSchedule(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  // Generate upcoming Sundays
  const upcomingSundays: string[] = [];
  let currentSunday = nextSunday(new Date());
  for (let i = 0; i < 8; i++) {
    upcomingSundays.push(format(currentSunday, 'MMMM do, yyyy'));
    currentSunday = addDays(currentSunday, 7);
  }

  const times = ['8:30 AM', '10:30 AM'];
  const roles = ['Teacher', 'Registration', 'Snacks', 'Arts and Craft', 'Playground Duty'];

  const handleRemind = async (date: string) => {
    setReminding(date);
    try {
      const resp = await fetch('/api/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      const data = await resp.json();
      if (data.success) {
        setRemindStatus({ ...remindStatus, [date]: 'Sent!' });
      } else {
        setRemindStatus({ ...remindStatus, [date]: 'Failed' });
      }
    } catch {
      setRemindStatus({ ...remindStatus, [date]: 'Failed' });
    }
    setReminding(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-start mb-6">
          <h2 className="text-3xl font-black uppercase border-b-4 border-[#1A1A1A] inline-block">Shift Roster</h2>
      </div>

      {loading ? (
        <div className="text-center font-bold text-xl uppercase italic">Loading roster...</div>
      ) : (
        <div className="space-y-12">
          {upcomingSundays.map(date => {
             const daySlots = schedule.filter(s => s.date === date);
             const totalSpots = times.length * roles.length;
             const openNum = totalSpots - daySlots.length;

             return (
               <div key={date} className="bg-white p-4 sm:p-6 brutal-border">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-[#1A1A1A] pb-4">
                   <div>
                     <h3 className="text-2xl font-black uppercase">{date}</h3>
                     <p className="font-bold text-[#1A1A1A] opacity-60 uppercase">{openNum > 0 ? `${openNum} SPOTS OPEN` : 'FULLY BOOKED'}</p>
                   </div>
                   <button 
                     onClick={() => handleRemind(date)}
                     disabled={reminding === date || openNum === 0 || remindStatus[date] === 'Sent!'}
                     className={`flex items-center gap-2 px-4 py-2 font-black uppercase brutal-border-sm transition-colors ${openNum === 0 ? 'bg-gray-200 opacity-50' : remindStatus[date] === 'Sent!' ? 'bg-green-400 text-black' : 'bg-yellow-300 hover:bg-black hover:text-white'}`}
                   >
                     <Mail size={20} />
                     {reminding === date ? 'SENDING...' : remindStatus[date] || 'Remind Team'}
                   </button>
                 </div>

                 <div className="space-y-8">
                   {times.map(time => (
                     <div key={time}>
                       <h4 className="text-xl font-black bg-yellow-300 inline-block px-3 py-1 brutal-border-sm mb-4">{time}</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {roles.map(role => {
                            const person = daySlots.find(s => s.time === time && s.role === role);
                            return (
                              <div key={role} className={`p-4 border-4 border-[#1A1A1A] flex justify-between items-center ${person ? 'bg-white' : 'bg-[#FDF8F3] opacity-60'}`}>
                                <span className="font-bold uppercase text-sm sm:text-base">{role}</span>
                                {person ? (
                                  <span className={`font-black uppercase text-sm sm:text-base px-2 py-1 border-2 border-[#1A1A1A] ${person.volunteerName.includes('(Tentative)') ? 'bg-orange-300 italic text-white line-through decoration-black decoration-2' : 'bg-yellow-300'}`}>
                                    {person.volunteerName.replace('(Tentative)', '').trim()}
                                    {person.volunteerName.includes('(Tentative)') && <span className="block text-xs text-black not-italic no-underline">Tentative</span>}
                                  </span>
                                ) : (
                                  <span className="font-bold uppercase text-sm text-red-500">OPEN</span>
                                )}
                              </div>
                            );
                         })}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
}

export default App;

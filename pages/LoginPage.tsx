
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Briefcase, AlertCircle, Mail, ArrowRight, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'SIGNUP') {
        await signup(email, password);
        navigate('/dashboard');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setError('');
      setLoading(true);
      try {
          await googleLogin();
          navigate('/dashboard');
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Particles */}
      <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in-up">
        <div className="flex justify-center mb-6">
           <div className="p-4 bg-gradient-to-br from-brand-600 to-accent-cyan rounded-2xl shadow-2xl shadow-brand-500/20">
               <Briefcase size={40} className="text-white" />
           </div>
        </div>
        <h2 className="text-center text-4xl font-extrabold text-white font-heading tracking-tight mb-2">
          RSA System
        </h2>
        <p className="text-center text-sm text-gray-400">
          Advanced Workflow & Attendance Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="glass-panel py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-white/10 backdrop-blur-xl">
          
          <div className="flex justify-center mb-8">
             <div className="bg-navy-800 p-1 rounded-xl inline-flex border border-white/10">
                <button 
                  onClick={() => setMode('LOGIN')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'LOGIN' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setMode('SIGNUP')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'SIGNUP' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Sign Up
                </button>
             </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 flex items-start rounded-xl animate-shake">
                <AlertCircle className="text-red-400 mr-3 flex-shrink-0" size={20}/>
                <p className="text-sm text-red-200 font-medium">{error}</p>
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input block w-full pl-10 pr-3 py-3 rounded-xl sm:text-sm placeholder-gray-500 focus:ring-2 focus:ring-brand-500 transition-all text-white bg-navy-900/50"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === 'LOGIN' ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input block w-full pl-10 pr-10 py-3 rounded-xl sm:text-sm placeholder-gray-500 focus:ring-2 focus:ring-brand-500 transition-all text-white bg-navy-900/50"
                  placeholder="••••••••"
                />
                <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-900/50 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-navy-900 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
              >
                {loading ? (
                   <span className="flex items-center">
                     <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Processing...
                   </span>
                ) : (
                   <span className="flex items-center uppercase tracking-wide">
                     {mode === 'LOGIN' ? 'Sign In' : 'Create Account'} 
                     {mode === 'LOGIN' ? <ArrowRight size={18} className="ml-2"/> : <UserPlus size={18} className="ml-2"/>}
                   </span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-navy-800/80 text-gray-400 rounded-full backdrop-blur-sm">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-white/10 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md transform hover:-translate-y-0.5"
              >
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} R. Sapkota & Associates. <br/>Secure RSA Portal System.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

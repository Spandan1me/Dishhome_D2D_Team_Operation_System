import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User as UserIcon, Lock, AlertCircle, Loader2 } from 'lucide-react';
import dishhomeBg from '../../assets/DishHome-Internet.png';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await login(username.trim(), password, rememberMe);

      // Route by role
      if (user.role === 'AGENT') {
        navigate('/agent/dashboard');
      } else {
        navigate('/supervisor/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.non_field_errors?.[0] ||
                  err.response?.data?.detail ||
                  'Invalid username or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center md:justify-end overflow-hidden select-none"
      style={{
        backgroundImage: `url(${dishhomeBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#EACACA',
      }}
    >
      {/* Authentic DishHome Operation Support System Login Card */}
      <div className="w-full max-w-[360px] mx-4 md:mr-[6%] lg:mr-[8%] xl:mr-[9%] z-10">
        <div
          className="bg-white rounded-[22px] p-6 pt-5 pb-7 border border-white/40"
          style={{
            boxShadow: '0 2px 15px rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Header: OPERATION SUPPORT SYSTEM framed by solid black horizontal lines */}
          <div className="my-1 border-t-[2px] border-b-[2px] border-black py-1.5 text-center">
            <h4 className="text-[17px] font-bold text-[#333] tracking-wide uppercase m-0 font-sans">
              OPERATION SUPPORT SYSTEM
            </h4>
          </div>

          {/* Subtitle */}
          <p className="text-center text-[13px] text-[#555] mt-3.5 mb-5 font-normal">
            Sign in to start your session
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-danger text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <div className="relative flex items-center bg-[#E8F0FE] rounded-t border-b border-[#ddd] focus-within:border-b-2 focus-within:border-[#1F91F3] transition-all">
                <span className="pl-3 pr-2.5 text-[#555]">
                  <UserIcon className="w-4 h-4 fill-[#555] text-[#555]" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoFocus
                  required
                  className="w-full bg-transparent py-2.5 pr-3 text-[14px] text-[#222] placeholder:text-gray-400 focus:outline-none font-normal"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="relative flex items-center bg-[#E8F0FE] rounded-t border-b border-[#ddd] focus-within:border-b-2 focus-within:border-[#1F91F3] transition-all">
                <span className="pl-3 pr-2.5 text-[#555]">
                  <Lock className="w-4 h-4 fill-[#555] text-[#555]" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full bg-transparent py-2.5 pr-3 text-[14px] text-[#222] placeholder:text-gray-400 focus:outline-none font-normal"
                />
              </div>
            </div>

            {/* Remember Me & SIGN IN Button Row */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[13px] text-[#555] cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="rememberme"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-400 text-pink-600 accent-pink-600 cursor-pointer"
                />
                <span>Remember Me</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#F44336] hover:bg-[#E53935] text-white text-[13px] font-bold uppercase rounded shadow hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center min-w-[90px]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>SIGN IN</span>}
              </button>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right pt-2">
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Please contact the DishHome System Administrator to reset your password.");
                }}
                className="text-[13px] text-[#00BCD4] hover:underline font-normal"
              >
                Forgot Password?
              </a>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};

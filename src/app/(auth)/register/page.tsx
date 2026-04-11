'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Lock } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Hero/Branding Section */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 px-8 py-12 lg:w-[60%] lg:py-0">
        {/* Floating abstract shapes */}
        <div className="animate-float absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="animate-float-delayed absolute bottom-[15%] right-[10%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="animate-pulse-glow absolute left-[50%] top-[60%] h-40 w-40 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative z-10 text-center">
          <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_0_30px_rgba(20,184,166,0.4)] lg:text-8xl">
            PWM
          </h1>
          <p className="mt-4 text-xl font-semibold text-teal-200 lg:text-2xl">
            Personal Wealth Management
          </p>
          <p className="mt-3 max-w-md text-sm text-slate-400 lg:text-base">
            Kelola keuangan pribadi Anda dengan mudah dan terstruktur
          </p>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 dark:bg-slate-950 lg:w-[40%] lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              Buat Akun Baru
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Daftar untuk mulai mengelola keuangan Anda
            </p>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-600 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Registrasi berhasil! Silakan cek email Anda.
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Buat kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || success}
              className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-base font-semibold text-white shadow-lg transition-all hover:from-teal-600 hover:to-cyan-600 hover:shadow-xl"
            >
              {loading ? 'Memproses...' : 'Daftar'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Sudah punya akun?{' '}
              <Link
                href="/login"
                className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline"
              >
                Masuk
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

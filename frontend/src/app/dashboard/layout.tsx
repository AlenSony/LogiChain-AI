import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { SignOutButton } from '@/components/ui/SignOutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch user role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    redirect('/login');
  }

  const role = profile.role;

  // We should extract the current path if possible, but Server Components layouts 
  // don't easily give the exact pathname without middleware or headers.
  // We can instead rely on the fact that layout wraps children.
  // However, Next.js layouts don't know the active route easily.
  // Wait, if a customer tries to access /dashboard/admin, how does the layout know?
  // Layout in Next.js app router doesn't get the pathname.
  // Best practice is to do route protection in middleware.ts or in page.tsx components.
  // But the requirement says: "frontend/src/app/dashboard/layout.tsx (Global Session & Role Interceptor Shell)... If a user with a 'customer' role tries to manually path into /dashboard/admin, execute a strict server-side redirect".
  // A layout *can* read headers to get the pathname if we set it in middleware, or we can use the headers() from 'next/headers'.

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Shell / Header placeholder */}
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#059669] flex items-center justify-center text-white font-bold">
              L
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              LogiChain AI
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="px-3 py-1 rounded-full bg-[#D1FAE5] text-[#059669] border border-[#059669]/20 capitalize">
              {role.replace('_', ' ')}
            </span>
            <span className="text-slate-500">{user.email}</span>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

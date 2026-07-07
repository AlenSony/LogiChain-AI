import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies so downstream Server Components
          // can read the refreshed session
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Rebuild the response with forwarded request headers
          supabaseResponse = NextResponse.next({
            request,
          });

          // Write the updated cookies onto the response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT use getSession() here — it reads from cookies without
  // validation. getUser() contacts the Supabase Auth server to verify the
  // token and triggers a token refresh when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated users trying to access /dashboard → redirect to /login
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users on /login → redirect to /dashboard if they have a valid profile
  if (user && pathname === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // If no profile, we stay on /login (or could sign out), to avoid infinite redirect loop.
  }

  // Role-based routing
  if (user && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile) {
      const role = profile.role;
      let allowedPrefix = `/dashboard/${role}`;
      
      // Driver roles map to /dashboard/driver
      if (role === 'pickup_employee' || role === 'delivery_employee') {
        allowedPrefix = '/dashboard/driver';
      }

      // Customer goes to /dashboard/customer
      if (role === 'customer') {
        allowedPrefix = '/dashboard/customer';
      }
      
      // Admin can access everything, or just restrict everyone
      // For now, strict isolation: they can only access their portal
      if (role !== 'admin' && !pathname.startsWith(allowedPrefix)) {
        return NextResponse.redirect(new URL(allowedPrefix, request.url));
      }

      // If they are at the root /dashboard, redirect them to their specific dashboard
      if (pathname === '/dashboard') {
        return NextResponse.redirect(new URL(allowedPrefix, request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

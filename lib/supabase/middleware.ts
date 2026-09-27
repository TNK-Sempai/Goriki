import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    // Source de vérité UNIQUE des rôles : `profiles.role` — comme les layouts et
    // toutes les routes API. Lire `app_metadata.role` ici créait deux vérités
    // divergentes (mission 03 §E1).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  if (request.nextUrl.pathname.startsWith('/compte')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  // Page de set inexistante : vrai 404 HTTP. Le `notFound()` de `SetDetail`
  // arrive trop tard, `app/catalogue/loading.tsx` a déjà envoyé le squelette
  // avec un statut 200, et aucun layout de set n'est hors de cette frontière.
  // Seul ce point, en amont du rendu, peut encore fixer le statut. La page est
  // rendue telle quelle, seul le statut change.
  const set = request.nextUrl.pathname.match(/^\/catalogue\/(pokemon|onepiece)\/([^/]+)\/?$/)
  if (set && set[2] !== 'series') {
    const existe =
      UUID.test(set[2]) &&
      !!(await supabase
        .from(set[1] === 'pokemon' ? 'pokemon_sets' : 'onepiece_sets')
        .select('id')
        .eq('id', set[2])
        .maybeSingle()).data
    if (!existe) {
      const introuvable = NextResponse.rewrite(request.nextUrl, { request, status: 404 })
      supabaseResponse.cookies.getAll().forEach(c => introuvable.cookies.set(c))
      return introuvable
    }
  }

  return supabaseResponse
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}

export default function NavItem({ href, label, icon: Icon, disabled = false }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))

  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded text-sm opacity-30 cursor-not-allowed select-none">
        <Icon size={15} />
        <span>{label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>V2</span>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
        isActive
          ? 'bg-amber text-bg font-medium'
          : 'text-muted hover:text-cream hover:bg-surface-2'
      }`}
    >
      <Icon size={15} />
      <span>{label}</span>
    </Link>
  )
}

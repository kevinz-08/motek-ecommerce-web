'use client'

/**
 * Flecha animada que hace scroll suave a la sección siguiente al hero.
 * Es un componente cliente porque usa onClick con window.scrollBy.
 */
export function ScrollDownArrow({ targetId }: { targetId: string }) {
  return (
    <button
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })}
      aria-label="Ir a la siguiente sección"
      className="animate-bounce text-white/70 hover:text-white transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

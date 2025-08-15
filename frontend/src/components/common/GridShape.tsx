/**
 * Grid Shape Background Component
 * Creates the sophisticated grid pattern used in auth pages
 */
import React from 'react'

export function GridShape() {
  return (
    <svg
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"
      width="404"
      height="404"
      viewBox="0 0 404 404"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M0 40L40 0M40 40L80 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="404" height="404" fill="url(#grid)" />
    </svg>
  )
}
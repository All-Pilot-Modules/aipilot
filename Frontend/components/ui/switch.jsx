"use client"

import * as React from "react"

const Switch = React.forwardRef(({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-blue-600' : 'bg-input'}
        ${className || ''}
      `}
      ref={ref}
      {...props}
    >
      <span
        className={`
          pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
});

Switch.displayName = "Switch";

export { Switch }
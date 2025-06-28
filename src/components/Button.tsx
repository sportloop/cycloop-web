/* eslint-disable react/button-has-type */
import { VariantProps, cva } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";

const button = cva(
  [
    "transition-all",
    "text-xl",
    "font-bold",
    "p-6",
    "disabled:opacity-50",
    "disabled:cursor-not-allowed",
    "focus:outline-none",
    "focus:ring",
    "focus:ring-blue-500",
    "focus:ring-offset-4",
    "ring-offset-black",
    "rounded-lg",
    "text-white text-opacity-70",
  ],
  {
    variants: {
      variant: {
        primary: "",
        secondary: "",
      },
    },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>
>(({ className, variant = "primary", children, ...props }, ref) => {
  const cls = button({ variant, className });
  return (
    <button ref={ref} className={cls} {...props} data-glow>
      <span>{children}</span>
    </button>
  );
});

Button.displayName = "Button";

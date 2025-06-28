import { cva } from "class-variance-authority";
import { type ClassProp } from "class-variance-authority/dist/types";
import { forwardRef } from "react";

//  box-shadow: 0 1rem 2rem -1rem black;
// padding: 1rem;
// display: grid;
// border: 1px solid hsl(0 0% 100% / 0.15);
// backdrop-filter: blur(calc(var(--cardblur, 5) * 1px));
const card = cva<React.HTMLAttributes<HTMLDivElement>>([
  "shadow-[0_1rem_2rem_-1rem_black]",
  "p-4",
  "grid",
  "rounded-lg",
  "border-[1px_solid_hsl(0_0%_100%_/_0.15)]",
  "backdrop-filter_blur-calc(var(--cardblur_5)_*_1px)",
]);

export const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => {
  const className = card(props as ClassProp);
  return <div ref={ref} data-glow {...props} className={className} />;
});

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => {
  return (
    <header
      ref={ref}
      className={`flex flex-col mb-4 ${className}`}
      {...props}
    />
  );
});

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => {
  return (
    <h2 ref={ref} className={`text-xl font-bold ${className}`} {...props} />
  );
});

CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={`text-md text-white text-opacity-60 ${className}`}
      {...props}
    />
  );
});

CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => {
  return <div ref={ref} className={`flex flex-col ${className}`} {...props} />;
});

CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => {
  return (
    <footer
      ref={ref}
      className={`flex items-center justify-between ${className}`}
      {...props}
    />
  );
});

CardFooter.displayName = "CardFooter";

Card.displayName = "Card";

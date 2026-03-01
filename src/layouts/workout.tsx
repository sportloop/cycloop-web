import { PropsWithChildren } from "react";

export default function WorkoutLayout({
  children,
}: PropsWithChildren<Record<string, never>>) {
  return <>{children}</>;
}

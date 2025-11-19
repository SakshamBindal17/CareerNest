// client/app/providers.tsx
"use client"; 

import { ThemeProvider } from "next-themes";
import { UserProvider } from "@/context/UserContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <UserProvider>
        {children}
      </UserProvider>
    </ThemeProvider>
  );
}
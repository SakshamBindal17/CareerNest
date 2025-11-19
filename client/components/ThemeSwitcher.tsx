// client/components/ThemeSwitcher.tsx
"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10 p-2" />; // Placeholder
  }

  const toggleTheme = () => {
    // Use the effective theme so toggling works even when theme === 'system'
    setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-pressed={(resolvedTheme ?? theme) === "dark"}
    >
      {(resolvedTheme ?? theme) === "dark" ? (
        <Sun className="w-5 h-5" /> 
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};

export default ThemeSwitcher;
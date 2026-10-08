"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      className="shrink-0 transition-transform active:scale-90"
    >
      {!mounted ? null : theme === "dark" ? (
        <Sun className="size-4 transition-transform duration-300 ease-out hover:rotate-45" />
      ) : (
        <Moon className="size-4 transition-transform duration-300 ease-out hover:-rotate-12" />
      )}
    </Button>
  );
}

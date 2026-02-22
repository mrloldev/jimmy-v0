"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ChatSelector } from "./chat-selector";

interface AppHeaderProps {
  className?: string;
}

export function AppHeader({ className = "" }: AppHeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  // Handle logo click - reset UI if on homepage, otherwise navigate to homepage
  const handleLogoClick = (e: React.MouseEvent) => {
    if (isHomepage) {
      e.preventDefault();
      // Add reset parameter to trigger UI reset
      window.location.href = "/?reset=true";
    }
    // If not on homepage, let the Link component handle navigation normally
  };

  return (
    <div className={cn("border-border border-b dark:border-input", className)}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              onClick={handleLogoClick}
              className="font-semibold text-gray-900 text-lg hover:text-gray-700 dark:text-white dark:hover:text-gray-300"
            >
              Jimmy
            </Link>
            <ChatSelector />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              className="h-fit px-2 py-1.5 text-sm"
              asChild
            >
              <Link
                href="https://github.com/mrloldev/jimmy-v0"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon size={16} />
                jimmy-v0
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

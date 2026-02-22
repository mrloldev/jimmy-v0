"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

interface SWRProviderProps {
  children: ReactNode;
}

interface FetchError extends Error {
  info?: unknown;
  status?: number;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: async (url: string) => {
          try {
            const res = await fetchWithRetry(url, {
              retries: 2,
              retryDelay: 1000,
              timeout: 15000,
            });
            if (!res.ok) {
              const error = new Error(
                "An error occurred while fetching the data.",
              ) as FetchError;
              try {
                error.info = await res.json();
              } catch {
                error.info = await res.text();
              }
              error.status = res.status;
              throw error;
            }
            return res.json();
          } catch (error) {
            if (
              error instanceof TypeError &&
              error.message.includes("Failed to fetch")
            ) {
              const networkError = new Error(
                "Network error: Please check your internet connection.",
              ) as FetchError;
              networkError.status = 0;
              throw networkError;
            }
            throw error;
          }
        },
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshInterval: 0,
        errorRetryCount: 2,
        errorRetryInterval: 2000,
        shouldRetryOnError: (error) => {
          if (error?.status === 404 || error?.status === 403) {
            return false;
          }
          return true;
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

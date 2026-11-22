import { createClient } from "@supabase/supabase-js";

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  }
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new Error("Missing required environment variable: VITE_SUPABASE_URL.");
  }
  if (!publishableKey) {
    throw new Error(
      "Missing required environment variable: VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid URL.");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("VITE_SUPABASE_URL must use HTTP or HTTPS.");
  }

  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error(
      "A Supabase secret key cannot be used in the client. Use the publishable key.",
    );
  }

  const jwtPayload = publishableKey.split(".")[1];
  if (jwtPayload) {
    try {
      const decodedPayload = atob(
        jwtPayload.replace(/-/g, "+").replace(/_/g, "/"),
      );
      const payload: unknown = JSON.parse(decodedPayload);
      if (
        typeof payload === "object" &&
        payload !== null &&
        "role" in payload &&
        payload.role === "service_role"
      ) {
        throw new Error(
          "A Supabase service-role key cannot be used in the client. Use the publishable key.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("service-role")) {
        throw error;
      }
    }
  }

  return { url, publishableKey };
}

const { url, publishableKey } = getSupabaseConfig();

export const supabase = createClient(url, publishableKey);

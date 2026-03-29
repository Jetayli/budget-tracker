import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

// Initialize Supabase client for server-side verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Authentication will fail."
  );
}

// Use service role key for server-side operations (can verify any JWT)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Authentication middleware that verifies Supabase JWT tokens
 * Extracts user ID from the token and attaches it to the request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    if (!supabaseAdmin) {
      res.status(500).json({ error: "Authentication service not configured" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify the JWT token using Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Attach user info to request
    req.userId = user.id;
    req.userEmail = user.email;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Optional auth middleware - attaches user if token present, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ") || !supabaseAdmin) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      req.userId = user.id;
      req.userEmail = user.email;
    }

    next();
  } catch {
    // If token verification fails, just continue without user
    next();
  }
}


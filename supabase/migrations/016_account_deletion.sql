-- =====================================================
-- Migration 016: Self-service account deletion
-- Allows a logged-in user to delete their own auth account.
-- Deleting from auth.users cascades to public.users (FK ON DELETE CASCADE)
-- and then to posts/swaps/messages etc. via their own cascades.
-- The app calls this via supabase.rpc('delete_own_account').
-- Also grants the client permission to call it.
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- Verification:
-- As an authenticated user: SELECT delete_own_account();
-- The session should become invalid and public.users row should be gone.

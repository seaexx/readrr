-- Atomically increment total_swaps for both parties when a swap is completed.
-- Replaces the fragile read-modify-write logic in the client.
CREATE OR REPLACE FUNCTION increment_total_swaps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.users
      SET total_swaps = total_swaps + 1
      WHERE id IN (NEW.requester_id, NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_total_swaps
  AFTER UPDATE ON public.swaps
  FOR EACH ROW EXECUTE FUNCTION increment_total_swaps();

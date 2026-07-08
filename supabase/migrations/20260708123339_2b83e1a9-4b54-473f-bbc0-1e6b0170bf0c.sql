-- Tighten SELECT policies on collection_item_reactions to add explicit
-- ownership check for authenticated path and restrict public path to anon.
DROP POLICY IF EXISTS "Public can view reactions for public collections" ON public.collection_item_reactions;

CREATE POLICY "Owners can view own collection reactions"
  ON public.collection_item_reactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_item_reactions.collection_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view reactions via valid share token"
  ON public.collection_item_reactions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_item_reactions.collection_id
        AND c.is_public = true
        AND c.share_token IS NOT NULL
        AND (c.share_expires_at IS NULL OR c.share_expires_at > now())
    )
  );
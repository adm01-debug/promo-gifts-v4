-- LOTE C 1/2 - favorite_item_reactions
CREATE TABLE public.favorite_item_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL, list_id uuid NOT NULL,
  anon_id text NOT NULL, emoji text NOT NULL,
  ip_hash text NULL, user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorite_item_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT favorite_item_reactions_item_id_anon_id_emoji_key UNIQUE (item_id,anon_id,emoji),
  CONSTRAINT favorite_item_reactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.favorite_items(id) ON DELETE CASCADE,
  CONSTRAINT favorite_item_reactions_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.favorite_lists(id) ON DELETE CASCADE
);
CREATE INDEX idx_favorite_reactions_item ON public.favorite_item_reactions(item_id);
CREATE INDEX idx_favorite_reactions_list ON public.favorite_item_reactions(list_id);
ALTER TABLE public.favorite_item_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own list reactions" ON public.favorite_item_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.favorite_lists l WHERE l.id=favorite_item_reactions.list_id AND l.user_id=auth.uid()));
CREATE POLICY "Admins read all reactions" ON public.favorite_item_reactions FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Public can read reactions of shared lists" ON public.favorite_item_reactions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.favorite_lists l WHERE l.id=favorite_item_reactions.list_id AND l.shared_token IS NOT NULL AND (l.shared_expires_at IS NULL OR l.shared_expires_at > now())));
CREATE POLICY "Public can insert reactions on shared lists" ON public.favorite_item_reactions FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.favorite_lists l WHERE l.id=favorite_item_reactions.list_id AND l.shared_token IS NOT NULL AND (l.shared_expires_at IS NULL OR l.shared_expires_at > now())));
CREATE POLICY "Owners delete own list reactions" ON public.favorite_item_reactions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.favorite_lists l WHERE l.id=favorite_item_reactions.list_id AND l.user_id=auth.uid()));

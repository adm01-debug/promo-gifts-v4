UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'] WHERE id = 'component-media';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','application/pdf','application/postscript','image/vnd.adobe.photoshop','application/illustrator'] WHERE id = 'mockup-art-files';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'] WHERE id = 'personalization-images';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['video/mp4','video/webm','video/quicktime','video/x-m4v'] WHERE id = 'product-videos';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf','text/plain','application/octet-stream'] WHERE id = 'quarantine';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'] WHERE id = 'supplier-logos';
UPDATE storage.buckets SET file_size_limit = 1048576, allowed_mime_types = ARRAY['text/plain','text/x-shellscript','application/x-sh','application/x-shellscript','application/json','application/javascript','application/octet-stream'] WHERE id = 'scripts';

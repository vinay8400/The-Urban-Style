-- Keep product images private while allowing signed reads for published products.
-- Match the Storage object name exactly to its product_images metadata path.
create policy product_images_storage_published_read
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.product_images as image
      join public.products as product on product.id = image.product_id
      where image.storage_path = storage.objects.name
        and product.status = 'published'
    )
  );

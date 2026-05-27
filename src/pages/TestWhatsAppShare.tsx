import { PromoFlixPlayer } from '@/components/products/gallery/PromoFlixPlayer';

export default function TestWhatsAppShare() {
  return (
    <div className="p-8 bg-black min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl">
        <PromoFlixPlayer
          src="https://customer-ksi0mrlcw6rwzezz.cloudflarestream.com/994ab6bea119baff0db95b4c9a067464/manifest/video.m3u8"
          isHls={true}
          productName="Garrafa Térmica Premium"
          title="Garrafa Térmica em uso"
          productId="test-123"
          productPrice={89.90}
          productSku="GT-PREMIUM-01"
          productMinQuantity={50}
          shareUrl="https://promobrindes.com.br/produto/garrafa-termica"
        />
      </div>
    </div>
  );
}

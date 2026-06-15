/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Air-gapped ortam: harici CDN'e bağımlı olmamak için tüm asset'ler
  // (font, JS, CSS) build sırasında bundle edilir, runtime'da dışarı çıkılmaz.
};

module.exports = nextConfig;

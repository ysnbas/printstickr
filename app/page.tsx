import StickerStudio from "@/components/StickerStudio";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white font-bold">
              ps
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                printstickr
              </h1>
              <p className="text-xs text-stone-500 leading-tight">
                A4 sticker sayfası üretici
              </p>
            </div>
          </div>
          <p className="hidden text-sm text-stone-500 sm:block">
            Tarayıcıda çalışır · Hiçbir görsel sunucuya yüklenmez
          </p>
        </div>
      </header>
      <StickerStudio />
    </main>
  );
}

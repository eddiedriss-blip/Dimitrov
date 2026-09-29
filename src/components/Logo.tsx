import Image from "next/image";

/** Logo « Secteur 1 » (public/logo-secteur1.webp, 2000 × 689, fond blanc). */
export function Logo({ taille = "normal" }: { taille?: "normal" | "grand" }) {
  return (
    <Image
      src="/logo-secteur1.webp"
      alt="Secteur 1"
      width={2000}
      height={689}
      priority
      sizes={taille === "grand" ? "(max-width: 640px) 80vw, 360px" : "160px"}
      className={taille === "grand" ? "h-auto w-full max-w-[22rem]" : "h-11 w-auto sm:h-12"}
    />
  );
}

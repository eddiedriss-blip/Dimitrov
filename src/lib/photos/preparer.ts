/**
 * Préparation des photos dans le navigateur avant envoi :
 * - redimensionnement (1920 px max) et conversion en JPEG → quelques centaines de Ko au lieu de plusieurs Mo ;
 * - miniature 480 px pour la grille ;
 * - l'orientation EXIF des photos de téléphone est appliquée.
 * Les formats que le navigateur ne sait pas décoder (ex. HEIC hors Safari) sont refusés avec un message clair.
 */

export const TAILLE_MAX_ORIGINAL = 25 * 1024 * 1024;
const COTE_IMAGE = 1920;
const COTE_MINIATURE = 480;

async function redimensionner(image: ImageBitmap, coteMax: number, qualite: number): Promise<Blob> {
  const ratio = Math.min(1, coteMax / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * ratio);
  const hauteur = Math.round(image.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Traitement d'image indisponible dans ce navigateur.");
  ctx.fillStyle = "#ffffff"; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.drawImage(image, 0, 0, largeur, hauteur);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion de l'image impossible."))), "image/jpeg", qualite),
  );
}

export async function preparerPhoto(fichier: File): Promise<{ image: Blob; miniature: Blob }> {
  if (fichier.size > TAILLE_MAX_ORIGINAL) {
    throw new Error(`${fichier.name} : fichier trop volumineux (25 Mo maximum).`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${fichier.name} : format non pris en charge par ce navigateur (utilisez JPEG, PNG ou WebP).`);
  }
  try {
    const [image, miniature] = await Promise.all([
      redimensionner(bitmap, COTE_IMAGE, 0.85),
      redimensionner(bitmap, COTE_MINIATURE, 0.75),
    ]);
    return { image, miniature };
  } finally {
    bitmap.close();
  }
}
